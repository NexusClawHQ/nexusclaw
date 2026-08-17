import express from 'express';
import {
  AgentExecution,
  ReactStep,
  ToolCallRecord,
} from '@agent-governance/audit-chain';
import { ApprovalInstance } from '@agent-governance/approval';
import type { SidecarRuntime } from './runtime.js';

const WS = '00000000-0000-4000-8000-000000000001';
const AGENT = '20000000-0000-4000-8000-000000000001';

export interface SidecarServer {
  app: express.Express;
  listen(port: number): Promise<{ url: string; close(): Promise<void> }>;
}

/**
 * The governance sidecar HTTP surface (local demo; no auth — the enterprise
 * path lives in the product). Endpoints:
 *   POST /executions          { agentId, input }            -> run / pause
 *   GET  /executions/:id      execution + steps + calls + outbox events
 *   GET  /approvals/pending   pending L2/L3 approvals
 *   POST /approvals/:id/decide { decision, comment }        -> approve resumes
 *   GET  /console             the mini governance console
 */
export function createSidecarServer(runtime: SidecarRuntime): SidecarServer {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/executions', async (req, res) => {
    const { agentId, input } = (req.body ?? {}) as { agentId?: string; input?: string };
    if (!input || typeof input !== 'string' || !input.trim()) {
      res.status(400).json({ error: 'input is required' });
      return;
    }
    const execution = await runtime.engine.run({
      workspaceId: WS,
      agentId: agentId ?? AGENT,
      rawInput: input,
      allowedTools: ['demo.customer_lookup', 'demo.send_followup_email'],
    });
    res.json({ executionId: execution.id, status: execution.status });
  });

  app.get('/executions/:id', async (req, res) => {
    const id = req.params.id;
    const execution = await runtime.dataSource.getRepository(AgentExecution).findOneByOrFail({ id });
    const steps = await runtime.dataSource.getRepository(ReactStep)
      .find({ where: { executionId: id }, order: { stepIndex: 'ASC' } });
    const calls = await runtime.dataSource.getRepository(ToolCallRecord)
      .find({ where: { executionId: id }, order: { createdAt: 'ASC' } });
    res.json({
      execution: { id: execution.id, status: execution.status, rawInput: execution.rawInput, createdAt: execution.createdAt, completedAt: execution.completedAt },
      steps: steps.map((s) => ({
        stepIndex: s.stepIndex,
        actionType: s.actionType,
        toolName: s.toolName,
        thoughtReasoning: s.thoughtReasoning,
        observationSuccess: s.observationSuccess,
        observationOutput: s.observationOutput,
        observationError: s.observationError,
        guardrailTriggered: s.guardrailTriggered,
      })),
      toolCalls: calls.map((c) => ({
        toolName: c.toolName,
        status: c.status,
        permissionCheck: c.permissionCheck,
        guardrailCheck: c.guardrailCheck,
        durationMs: c.durationMs,
      })),
    });
  });

  app.get('/approvals/pending', async (_req, res) => {
    const rows = await runtime.approvals.pending(WS);
    res.json({
      approvals: rows.map((row) => {
        const marker = '__pausedToolCall__:';
        const idx = row.history?.[0]?.comments?.indexOf(marker) ?? -1;
        let paused: unknown = null;
        if (idx >= 0) {
          try { paused = JSON.parse(row.history![0]!.comments!.slice(idx + marker.length)); } catch { /* ignore */ }
        }
        return {
          id: row.id,
          executionId: row.recordId,
          status: row.status,
          submittedAt: row.submittedAt,
          pausedToolCall: paused,
        };
      }),
    });
  });

  app.post('/approvals/:id/decide', async (req, res) => {
    const { decision, comment } = (req.body ?? {}) as { decision?: string; comment?: string };
    const normalized = decision?.toUpperCase();
    if (normalized !== 'APPROVED' && normalized !== 'REJECTED') {
      res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });
      return;
    }
    const row = await runtime.dataSource.getRepository(ApprovalInstance).findOneByOrFail({ id: req.params.id });
    if (row.status !== 'PENDING') {
      res.status(409).json({ error: 'APPROVAL_ALREADY_DECIDED' });
      return;
    }
    const paused = JSON.parse(
      row.history![0]!.comments!.split('__pausedToolCall__:')[1]!,
    ) as { toolName: string; toolInput: Record<string, unknown>; riskLevel: string; description?: string };
    const resumeCall = { toolName: paused.toolName, toolInput: paused.toolInput, riskLevel: paused.riskLevel, description: paused.description ?? paused.toolName };

    if (normalized === 'REJECTED') {
      await runtime.dataSource.getRepository(ApprovalInstance)
        .update(row.id, { status: 'REJECTED', completedAt: new Date() });
      res.json({ instanceId: row.id, decision: normalized, executionId: row.recordId, executionStatus: 'cancelled' });
      return;
    }

    // APPROVED: record the decision, then resume the paused execution.
    // Gate-sourced executions (external frameworks) do not run the built-in
    // ReAct loop — the caller executes the tool locally and reports via
    // POST /gate/:executionId/complete.
    const gatedExecution = await runtime.dataSource.getRepository(AgentExecution)
      .findOneBy({ id: row.recordId });
    if (gatedExecution?.triggerSource === 'governance_gate') {
      await runtime.dataSource.getRepository(AgentExecution).update(row.recordId, {
        status: 'running',
      });
      res.json({ instanceId: row.id, decision: normalized, executionId: row.recordId, executionStatus: 'running' });
      return;
    }
    await runtime.dataSource.getRepository(ApprovalInstance).update(row.id, {
      status: 'APPROVED',
      completedAt: new Date(),
      history: [...(row.history ?? []), {
        stepIndex: (row.currentStepIndex ?? 0) + 1,
        stepName: 'Agent Sensitive Operation',
        action: 'APPROVED',
        actorId: 'sidecar-console',
        actorName: 'Sidecar Console',
        comments: comment ?? '',
        timestamp: new Date().toISOString(),
      }],
    });
    const execution = await runtime.engine.resumePaused({
      executionId: row.recordId,
      workspaceId: WS,
      approvalInstanceId: row.id,
      pausedToolCall: resumeCall,
    });
    res.json({ instanceId: row.id, decision: normalized, executionId: row.recordId, executionStatus: execution.status });
  });

  app.post('/gate', async (req, res) => {
    const { toolName, toolInput } = (req.body ?? {}) as {
      toolName?: string;
      toolInput?: Record<string, unknown>;
    };
    if (!toolName || typeof toolName !== 'string') {
      res.status(400).json({ error: 'toolName is required' });
      return;
    }
    try {
      const result = await runtime.gate.gate({
        toolName,
        toolInput: toolInput ?? {},
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error)?.message ?? 'gate failed' });
    }
  });

  app.post('/gate/:executionId/complete', async (req, res) => {
    const { success, output } = (req.body ?? {}) as { success?: boolean; output?: unknown };
    try {
      await runtime.gate.complete(req.params.executionId, {
        success: success !== false,
        output,
      });
      res.json({ executionId: req.params.executionId, status: 'completed' });
    } catch (error) {
      res.status(409).json({ error: (error as Error)?.message ?? 'complete failed' });
    }
  });

  app.get('/audit/list', async (_req, res) => {
    const executions = await runtime.dataSource.getRepository(AgentExecution).find({
      order: { createdAt: 'DESC' },
      take: 10,
    });
    const out = [];
    for (const execution of executions) {
      const steps = await runtime.dataSource.getRepository(ReactStep)
        .find({ where: { executionId: execution.id }, order: { stepIndex: 'ASC' } });
      const calls = await runtime.dataSource.getRepository(ToolCallRecord)
        .find({ where: { executionId: execution.id }, order: { createdAt: 'ASC' } });
      out.push({
        id: execution.id,
        status: execution.status,
        rawInput: execution.rawInput,
        steps: steps.map((s) => ({
          stepIndex: s.stepIndex, actionType: s.actionType, toolName: s.toolName,
          observationOutput: s.observationOutput, observationError: s.observationError,
          guardrailTriggered: s.guardrailTriggered,
        })),
        toolCalls: calls.map((c) => ({
          toolName: c.toolName, status: c.status, permissionCheck: c.permissionCheck, guardrailCheck: c.guardrailCheck,
        })),
      });
    }
    res.json({ executions: out });
  });

  app.get('/console', (_req, res) => {
    res.type('html').send(CONSOLE_HTML);
  });

  return {
    app,
    async listen(port: number) {
      const server = await new Promise<import('node:http').Server>((resolve) => {
        const s = app.listen(port, '127.0.0.1', () => resolve(s));
      });
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      return {
        url: `http://127.0.0.1:${actualPort}`,
        async close() {
          await new Promise<void>((resolve) => server.close(() => resolve()));
        },
      };
    },
  };
}

const CONSOLE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>agent-governance sidecar console</title>
<style>
  :root { --bg:#f5f6f8; --card:#fff; --ink:#1c2430; --muted:#66707d; --line:#e3e6eb; --brand:#3452d9;
          --ok:#137a4d; --ok-bg:#e4f5ec; --warn:#92600a; --warn-bg:#fdf1dc; --err:#a02c2c; --err-bg:#fbe7e7; }
  * { box-sizing:border-box; }
  body { margin:0; font:14px/1.55 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif; background:var(--bg); color:var(--ink); }
  header { display:flex; align-items:center; gap:12px; padding:12px 20px; background:#101728; color:#fff; }
  header .brand { font-weight:700; } header .sub { opacity:.65; font-size:12px; } header .spacer { flex:1; }
  header button { background:transparent; border:1px solid rgba(255,255,255,.35); color:#fff; border-radius:6px; padding:4px 10px; cursor:pointer; }
  main { max-width:1080px; margin:24px auto; padding:0 16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:18px; margin-bottom:16px; }
  .row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  textarea { width:100%; min-height:70px; font:inherit; padding:8px; border:1px solid var(--line); border-radius:8px; }
  .btn { font:inherit; padding:8px 16px; border-radius:8px; border:1px solid var(--brand); background:var(--brand); color:#fff; cursor:pointer; }
  .btn.ghost { background:#fff; color:var(--brand); } .btn.danger { background:#fff; color:var(--err); border-color:var(--err); }
  .tabs { display:flex; gap:6px; margin-bottom:16px; }
  .tabs button { font:inherit; padding:8px 14px; border:1px solid var(--line); border-bottom:none; background:#eceef1; color:var(--muted); cursor:pointer; }
  .tabs button.active { background:var(--card); color:var(--ink); font-weight:600; }
  .chip { display:inline-block; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:600; }
  .s-done { color:var(--ok); background:var(--ok-bg); } .s-guardrail_pending { color:var(--warn); background:var(--warn-bg); }
  .s-failed { color:var(--err); background:var(--err-bg); } .s-pending { color:var(--muted); background:#eceef1; }
  .r-L1 { color:#1d4ed8; background:#e3ecfd; } .r-L3 { color:var(--warn); background:var(--warn-bg); }
  .step { border-left:3px solid var(--line); padding:8px 12px; margin:8px 0; background:#fafbfc; border-radius:0 8px 8px 0; }
  .muted { color:var(--muted); } pre { background:#0f1626; color:#d7e0f5; padding:10px; border-radius:8px; overflow:auto; font-size:12px; }
  table { width:100%; border-collapse:collapse; font-size:13px; } th,td { text-align:left; padding:7px 10px; border-bottom:1px solid var(--line); }
  .approval { border:1px solid var(--line); border-radius:10px; padding:14px; margin-bottom:12px; }
  .hint { background:#e3ecfd; color:#1d4ed8; border-radius:8px; padding:8px 12px; font-size:13px; margin-bottom:12px; }
</style>
</head>
<body>
<header><span class="brand">agent-governance</span><span class="sub" id="i18nSub"></span><span class="spacer"></span><button id="langToggle"></button></header>
<main>
  <div class="card">
    <div class="hint" id="i18nHint"></div>
    <textarea id="taskInput"></textarea>
    <div class="row" style="margin-top:10px;"><button class="btn" id="runBtn"></button><span class="muted" id="runMsg"></span></div>
    <div id="runError" style="color:var(--err);margin-top:8px;"></div>
  </div>
  <div class="tabs">
    <button data-tab="approvals" class="active"></button>
    <button data-tab="audit"></button>
  </div>
  <div id="tab-approvals"><div id="approvalList"></div></div>
  <div id="tab-audit" class="hidden" style="display:none;"><div id="auditList"></div></div>
</main>
<script>
(function () {
  var COPY = {
    zh: { sub:'治理 sidecar 演示控制台', hint:'确定性剧本（无需 LLM）：L1 客户查询放行并审计 → L3 外发邮件暂停等待人工审批 → 批准后恢复完成。审计链四表全落库。', run:'执行任务', approvals:'审批', audit:'审计链', approve:'批准', reject:'拒绝', emptyA:'暂无待审批项', emptyE:'暂无执行记录' },
    en: { sub:'Governance sidecar demo console', hint:'Deterministic scenario (no LLM): L1 lookup proceeds and is audited → L3 email pauses for approval → approval resumes to completion. Full audit chain persisted.', run:'Run task', approvals:'Approvals', audit:'Audit chain', approve:'Approve', reject:'Reject', emptyA:'No pending approvals', emptyE:'No executions yet' }
  };
  var lang = localStorage.getItem('sg_lang') || 'zh';
  function t(k) { return (COPY[lang] || COPY.zh)[k] || k; }
  function applyCopy() {
    document.getElementById('i18nSub').textContent = t('sub');
    document.getElementById('i18nHint').textContent = t('hint');
    document.getElementById('runBtn').textContent = t('run');
    var btns = document.querySelectorAll('.tabs button');
    btns[0].textContent = t('approvals'); btns[1].textContent = t('audit');
    document.getElementById('langToggle').textContent = lang === 'zh' ? 'EN' : '中文';
  }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function chip(status) { return el('span', 'chip s-' + status, status); }
  function statusText(s) { return s === 'done' ? (lang === 'zh' ? '已完成' : 'Done') : s === 'guardrail_pending' ? (lang === 'zh' ? '等待审批' : 'Awaiting approval') : s; }
  var $ = function (id) { return document.getElementById(id); };

  document.getElementById('runBtn').addEventListener('click', function () {
    $('runError').textContent = ''; $('runMsg').textContent = '…';
    fetch('/executions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: $('taskInput').value }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        $('runMsg').textContent = (lang === 'zh' ? '执行状态：' : 'Status: ') + statusText(d.status);
        loadApprovals();
      })
      .catch(function (e) { $('runError').textContent = e.message; $('runMsg').textContent = ''; });
  });

  document.querySelectorAll('.tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('active', b === btn); });
      $('tab-approvals').style.display = btn.getAttribute('data-tab') === 'approvals' ? '' : 'none';
      $('tab-audit').style.display = btn.getAttribute('data-tab') === 'audit' ? '' : 'none';
      if (btn.getAttribute('data-tab') === 'audit') loadAudit();
    });
  });

  function loadApprovals() {
    fetch('/approvals/pending').then(function (r) { return r.json(); }).then(function (d) {
      var mount = $('approvalList'); mount.textContent = '';
      var list = d.approvals || [];
      if (!list.length) { mount.appendChild(el('div', 'muted', t('emptyA'))); return; }
      list.forEach(function (item) {
        var card = el('div', 'approval');
        var title = el('div', 'row');
        title.appendChild(el('span', 'chip r-' + (item.pausedToolCall && item.pausedToolCall.riskLevel || 'L2'), item.pausedToolCall && item.pausedToolCall.toolName || item.id));
        title.appendChild(chip('guardrail_pending'));
        card.appendChild(title);
        if (item.pausedToolCall) { card.appendChild(el('pre', null, JSON.stringify(item.pausedToolCall.toolInput, null, 2))); }
        var actions = el('div', 'row'); actions.style.marginTop = '10px';
        var ok = el('button', 'btn', t('approve')); var no = el('button', 'btn danger', t('reject'));
        var msg = el('span', 'muted');
        function decide(code) {
          fetch('/approvals/' + item.id + '/decide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: code }) })
            .then(function (r) { return r.json(); })
            .then(function (d) { msg.textContent = statusText(d.executionStatus); loadApprovals(); });
        }
        ok.addEventListener('click', function () { decide('APPROVED'); });
        no.addEventListener('click', function () { decide('REJECTED'); });
        actions.appendChild(ok); actions.appendChild(no); actions.appendChild(msg);
        card.appendChild(actions);
        mount.appendChild(card);
      });
    });
  }

  function loadAudit() {
    fetch('/executions').then(function (r) { return r.json(); }).catch(function () { return { executions: [] }; }).then(function () {
      // list via a lightweight endpoint: reuse /executions/:id by first listing
      return fetch('/audit/list').then(function (r) { return r.json(); }).catch(function () { return { executions: [] }; });
    }).then(function (d) {
      var mount = $('auditList'); mount.textContent = '';
      var list = d.executions || [];
      if (!list.length) { mount.appendChild(el('div', 'muted', t('emptyE'))); return; }
      list.forEach(function (exec) {
        var card = el('div', 'card');
        var head = el('div', 'row');
        head.appendChild(chip(exec.status));
        head.appendChild(el('span', 'muted', exec.id));
        card.appendChild(head);
        (exec.steps || []).forEach(function (s) {
          var box = el('div', 'step');
          box.appendChild(el('div', null, '#' + s.stepIndex + ' ' + s.actionType + (s.toolName ? ' ' + s.toolName : '') + (s.guardrailTriggered ? ' [guardrail]' : '')));
          if (s.observationOutput) box.appendChild(el('pre', null, JSON.stringify(s.observationOutput)));
          if (s.observationError) box.appendChild(el('div', 'muted', s.observationError));
          card.appendChild(box);
        });
        (exec.toolCalls || []).forEach(function (c) {
          card.appendChild(el('div', 'muted', 'tool ' + c.toolName + ' ' + c.status + ' permission=' + c.permissionCheck + ' guardrail=' + c.guardrailCheck));
        });
        mount.appendChild(card);
      });
    });
  }

  document.getElementById('langToggle').addEventListener('click', function () {
    lang = lang === 'zh' ? 'en' : 'zh'; localStorage.setItem('sg_lang', lang); applyCopy();
  });
  applyCopy();
  loadApprovals();
  setInterval(loadApprovals, 3000);
})();
</script>
</body>
</html>`;
