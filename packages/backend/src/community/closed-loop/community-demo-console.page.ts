/**
 * The Community demo console — a single static page, no build toolchain and
 * no host filesystem reads. Served at GET /console.
 *
 * CONSTRAINT (PROJECT_CONST §1.9): every branch/status key in this page is a
 * stable code (execution status, decision codes); user-facing strings come
 * only from the COPY map below via t(). No display string is ever used as a
 * state key.
 */
export const COMMUNITY_DEMO_CONSOLE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NexusClaw Community Console</title>
<style>
  :root {
    --bg: #f5f6f8; --card: #ffffff; --ink: #1c2430; --muted: #66707d;
    --line: #e3e6eb; --brand: #3452d9; --brand-ink: #ffffff;
    --ok: #137a4d; --ok-bg: #e4f5ec; --warn: #92600a; --warn-bg: #fdf1dc;
    --err: #a02c2c; --err-bg: #fbe7e7; --idle: #4b5563; --idle-bg: #eceef1;
    --run: #1d4ed8; --run-bg: #e3ecfd;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.55 -apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif; background: var(--bg); color: var(--ink); }
  header { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: #101728; color: #fff; }
  header .brand { font-weight: 700; letter-spacing: .3px; }
  header .sub { opacity: .65; font-size: 12px; }
  header .spacer { flex: 1; }
  header button { background: transparent; border: 1px solid rgba(255,255,255,.35); color: #fff; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 12px; }
  main { max-width: 1080px; margin: 24px auto; padding: 0 16px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 18px; margin-bottom: 16px; }
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  label { font-size: 13px; color: var(--muted); }
  input[type=text], input[type=password], textarea, select {
    font: inherit; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--ink);
  }
  textarea { width: 100%; min-height: 74px; resize: vertical; }
  .btn { font: inherit; padding: 8px 16px; border-radius: 8px; border: 1px solid var(--brand); background: var(--brand); color: var(--brand-ink); cursor: pointer; }
  .btn.secondary { background: #fff; color: var(--brand); }
  .btn.danger { background: #fff; color: var(--err); border-color: var(--err); }
  .btn:disabled { opacity: .5; cursor: default; }
  .tabs { display: flex; gap: 6px; margin-bottom: 16px; }
  .tabs button { font: inherit; padding: 8px 14px; border-radius: 8px 8px 0 0; border: 1px solid var(--line); border-bottom: none; background: #eceef1; color: var(--muted); cursor: pointer; position: relative; }
  .tabs button.active { background: var(--card); color: var(--ink); font-weight: 600; }
  .tabs .badge { position: absolute; top: -8px; right: -8px; background: var(--warn); color: #fff; border-radius: 10px; font-size: 11px; padding: 0 6px; }
  .chip { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .chip.s-pending    { color: var(--idle); background: var(--idle-bg); }
  .chip.s-running    { color: var(--run); background: var(--run-bg); }
  .chip.s-guardrail_pending { color: var(--warn); background: var(--warn-bg); }
  .chip.s-done       { color: var(--ok); background: var(--ok-bg); }
  .chip.s-failed, .chip.s-timeout { color: var(--err); background: var(--err-bg); }
  .chip.s-cancelled  { color: var(--idle); background: var(--idle-bg); }
  .chip.r-L1 { color: var(--run); background: var(--run-bg); }
  .chip.r-L3 { color: var(--warn); background: var(--warn-bg); }
  .chip.verdict-passed { color: var(--ok); background: var(--ok-bg); }
  .chip.verdict-denied { color: var(--err); background: var(--err-bg); }
  .chip.verdict-escalated { color: var(--warn); background: var(--warn-bg); }
  .kv { display: grid; grid-template-columns: max-content 1fr; gap: 2px 14px; font-size: 13px; }
  .kv dt { color: var(--muted); } .kv dd { margin: 0; word-break: break-all; }
  .step { border-left: 3px solid var(--line); padding: 8px 12px; margin: 8px 0; background: #fafbfc; border-radius: 0 8px 8px 0; }
  .step .m { color: var(--muted); font-size: 12px; }
  pre.json { background: #0f1626; color: #d7e0f5; padding: 10px 12px; border-radius: 8px; overflow: auto; font-size: 12px; max-height: 260px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 600; }
  tr.click { cursor: pointer; } tr.click:hover { background: #f7f9fd; }
  .empty { color: var(--muted); padding: 18px 0; text-align: center; }
  .error { color: var(--err); font-size: 13px; margin-top: 8px; white-space: pre-wrap; }
  .hint { background: var(--run-bg); color: var(--run); border-radius: 8px; padding: 8px 12px; font-size: 13px; margin-bottom: 12px; }
  .approval { border: 1px solid var(--line); border-radius: 10px; padding: 14px; margin-bottom: 12px; }
  .approval .title { font-weight: 600; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .approval .desc { color: var(--muted); margin: 6px 0; }
  .muted { color: var(--muted); } .mono { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  section h3 { margin: 14px 0 8px; font-size: 14px; }
  .hidden { display: none !important; }
</style>
</head>
<body>
<header>
  <span class="brand">NexusClaw</span>
  <span class="sub" data-i18n="app.subtitle"></span>
  <span class="spacer"></span>
  <button id="langToggle"></button>
  <button id="signOut" class="hidden" data-i18n="app.signOut"></button>
</header>
<main>
  <div id="loginView" class="card" style="max-width:420px;margin:48px auto;">
    <h2 style="margin-top:0;" data-i18n="login.title"></h2>
    <p class="muted" data-i18n="login.hint"></p>
    <div class="row" style="margin-bottom:10px;"><label style="width:88px;" data-i18n="login.username"></label><input type="text" id="username" value="demo"></div>
    <div class="row" style="margin-bottom:14px;"><label style="width:88px;" data-i18n="login.password"></label><input type="password" id="password" value="nexusclaw-demo"></div>
    <button class="btn" id="signIn" data-i18n="login.submit"></button>
    <div class="error" id="loginError"></div>
  </div>

  <div id="appView" class="hidden">
    <div class="tabs">
      <button data-tab="run" class="active" data-i18n="tab.run"></button>
      <button data-tab="approvals" data-i18n="tab.approvals"></button>
      <button data-tab="audit" data-i18n="tab.audit"></button>
    </div>

    <div id="tab-run">
      <div class="card">
        <div class="hint" data-i18n="run.hint"></div>
        <div class="row" style="margin-bottom:10px;">
          <label data-i18n="run.agent"></label>
          <select id="agentSelect"></select>
        </div>
        <textarea id="taskInput"></textarea>
        <div class="row" style="margin-top:10px;">
          <button class="btn" id="runBtn" data-i18n="run.submit"></button>
          <span class="muted" id="runMsg"></span>
        </div>
        <div class="error" id="runError"></div>
      </div>
      <div id="runExecution"></div>
    </div>

    <div id="tab-approvals" class="hidden">
      <div id="approvalList"><div class="empty" data-i18n="approvals.empty"></div></div>
    </div>

    <div id="tab-audit" class="hidden">
      <div class="card">
        <div class="row">
          <h3 style="margin:0;" data-i18n="audit.executions"></h3>
          <span class="spacer" style="flex:1"></span>
          <button class="btn secondary" id="auditRefresh" data-i18n="audit.refresh"></button>
        </div>
        <div id="auditList"><div class="empty" data-i18n="audit.empty"></div></div>
      </div>
      <div id="auditDetail"></div>
    </div>
  </div>
</main>
<script>
(function () {
  'use strict';

  // ---- i18n copy map: display strings ONLY here, keyed by stable codes ----
  var COPY = {
    zh: {
      'app.subtitle': '社区版治理闭环控制台',
      'app.signOut': '退出',
      'login.title': '登录演示工作区',
      'login.hint': '种子演示账号已预填：demo / nexusclaw-demo',
      'login.username': '用户名', 'login.password': '密码', 'login.submit': '登录',
      'tab.run': '运行', 'tab.approvals': '审批', 'tab.audit': '审计链',
      'run.hint': '确定性剧本（无需 LLM）：第一步 L1 客户查询（放行并审计）→ 第二步 L3 外发跟进邮件（暂停等待人工审批）→ 批准后继续执行完成。',
      'run.agent': '数字员工', 'run.submit': '执行任务',
      'approvals.empty': '当前没有待审批项',
      'approvals.title': '待审批的敏感操作',
      'approvals.decide': '审批意见（可选）',
      'approvals.approve': '批准', 'approvals.reject': '拒绝',
      'approvals.execution': '关联执行', 'approvals.submittedAt': '提交时间',
      'audit.executions': '执行记录', 'audit.refresh': '刷新',
      'audit.empty': '暂无执行记录，先到“运行”页发起一次任务',
      'audit.chain.steps': 'ReAct 步骤（react_steps）',
      'audit.chain.tools': '工具调用（tool_call_records）',
      'audit.chain.events': '事件流（outbox_events）',
      'audit.chain.exec': '执行（agent_executions）',
      'common.back': '返回', 'common.retry': '重试中…',
      'status.pending': '待运行', 'status.running': '运行中',
      'status.guardrail_pending': '等待审批', 'status.done': '已完成',
      'status.failed': '失败', 'status.timeout': '超时', 'status.cancelled': '已取消',
      'exec.input': '任务输入', 'exec.output': '输出摘要', 'exec.created': '创建时间',
      'exec.completed': '完成时间', 'exec.duration': '耗时', 'exec.tokens': '令牌',
      'step.thought': '思考', 'step.action': '动作', 'step.observation': '观察',
      'step.toolInput': '工具输入', 'step.output': '结果',
      'verdict.permission': '权限', 'verdict.guardrail': '护栏',
      'col.tool': '工具', 'col.status': '状态', 'col.permission': '权限',
      'col.guardrail': '护栏', 'col.duration': '耗时', 'col.time': '时间',
      'label.view': '查看',
      'msg.running': '任务已提交，正在跟踪…',
      'msg.decided': '已提交决定，执行状态：'
    },
    en: {
      'app.subtitle': 'Community governed closed-loop console',
      'app.signOut': 'Sign out',
      'login.title': 'Sign in to the demo workspace',
      'login.hint': 'Seeded demo credentials pre-filled: demo / nexusclaw-demo',
      'login.username': 'Username', 'login.password': 'Password', 'login.submit': 'Sign in',
      'tab.run': 'Run', 'tab.approvals': 'Approvals', 'tab.audit': 'Audit chain',
      'run.hint': 'Deterministic scenario (no LLM needed): step 1 L1 customer lookup (audited, proceeds) → step 2 L3 outbound follow-up email (pauses for human approval) → after approval the run resumes and completes.',
      'run.agent': 'Digital employee', 'run.submit': 'Run task',
      'approvals.empty': 'No pending approvals',
      'approvals.title': 'Pending sensitive operations',
      'approvals.decide': 'Comment (optional)',
      'approvals.approve': 'Approve', 'approvals.reject': 'Reject',
      'approvals.execution': 'Execution', 'approvals.submittedAt': 'Submitted at',
      'audit.executions': 'Executions', 'audit.refresh': 'Refresh',
      'audit.empty': 'No executions yet — run a task first',
      'audit.chain.steps': 'ReAct steps (react_steps)',
      'audit.chain.tools': 'Tool calls (tool_call_records)',
      'audit.chain.events': 'Event stream (outbox_events)',
      'audit.chain.exec': 'Execution (agent_executions)',
      'common.back': 'Back', 'common.retry': 'Retrying…',
      'status.pending': 'Pending', 'status.running': 'Running',
      'status.guardrail_pending': 'Awaiting approval', 'status.done': 'Done',
      'status.failed': 'Failed', 'status.timeout': 'Timeout', 'status.cancelled': 'Cancelled',
      'exec.input': 'Input', 'exec.output': 'Output summary', 'exec.created': 'Created at',
      'exec.completed': 'Completed at', 'exec.duration': 'Duration', 'exec.tokens': 'Tokens',
      'step.thought': 'Thought', 'step.action': 'Action', 'step.observation': 'Observation',
      'step.toolInput': 'Tool input', 'step.output': 'Output',
      'verdict.permission': 'Permission', 'verdict.guardrail': 'Guardrail',
      'col.tool': 'Tool', 'col.status': 'Status', 'col.permission': 'Permission',
      'col.guardrail': 'Guardrail', 'col.duration': 'Duration', 'col.time': 'Time',
      'label.view': 'View',
      'msg.running': 'Task submitted, tracking…',
      'msg.decided': 'Decision submitted, execution status: '
    }
  };

  var lang = localStorage.getItem('nc_console_lang') || 'zh';
  function t(code) {
    var table = COPY[lang] || COPY.zh;
    return table[code] != null ? table[code] : code;
  }
  function applyCopy() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    document.getElementById('langToggle').textContent = lang === 'zh' ? 'EN' : '中文';
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }

  // ---- tiny DOM helpers (textContent-only: no untrusted innerHTML) ----
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function statusChip(status) {
    return el('span', 'chip s-' + status, t('status.' + status));
  }
  function riskChip(risk) {
    return el('span', 'chip r-' + risk, risk);
  }
  function verdictChip(kind, value) {
    var node = el('span', 'chip verdict-' + value, value == null ? '—' : value);
    node.title = t('verdict.' + kind);
    return node;
  }
  function jsonBlock(value) {
    var pre = el('pre', 'json');
    try { pre.textContent = JSON.stringify(value, null, 2); }
    catch (e) { pre.textContent = String(value); }
    return pre;
  }
  function fmtTime(value) {
    if (!value) return '—';
    try { return new Date(value).toLocaleString(); } catch (e) { return String(value); }
  }

  // ---- GraphQL client ----
  var token = localStorage.getItem('nc_console_token') || '';
  function gql(query, variables) {
    return fetch('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: JSON.stringify({ query: query, variables: variables || {} })
    }).then(function (res) { return res.json(); });
  }
  function gqlData(query, variables) {
    return gql(query, variables).then(function (body) {
      if (body.errors && body.errors.length) throw new Error(body.errors[0].message);
      return body.data;
    });
  }

  var Q = {
    signIn: 'mutation S($u: String!, $p: String!) { communitySignIn(username: $u, password: $p) { token expiresAt } }',
    agents: 'query A { communityAgents { id name status } }',
    execute: 'mutation E($a: ID!, $i: String!) { communityExecuteAgent(agentId: $a, input: $i) { id status } }',
    execution: 'query X($id: ID!) { communityAgentExecution(id: $id) { id agentId status rawInput outputSummary createdAt completedAt durationMs totalInputTokens totalOutputTokens totalCost reactSteps { id stepIndex thoughtReasoning actionType toolName toolInput observationSuccess observationError observationOutput guardrailTriggered createdAt } toolCallRecords { id toolName status permissionCheck guardrailCheck durationMs input output createdAt } } }',
    pending: 'query P { communityPendingApprovals { id executionId toolName riskLevel description toolInput status submittedAt } }',
    decide: 'mutation D($i: ID!, $d: String!, $c: String) { communityDecideApproval(instanceId: $i, decision: $d, comment: $c) { instanceId decision executionId executionStatus } }',
    executions: 'query L($n: Int!) { communityAgentExecutions(limit: $n) { id status rawInput outputSummary createdAt completedAt durationMs totalInputTokens totalOutputTokens } }',
    events: 'query V($e: ID!) { communityExecutionEvents(executionId: $e) { id eventType payload createdAt } }'
  };

  // ---- state ----
  var activeTab = 'run';
  var trackExecutionId = null;
  var pollTimer = null;
  var approvalTimer = null;

  function $(id) { return document.getElementById(id); }

  // ---- auth ----
  function showApp() {
    $('loginView').classList.add('hidden');
    $('appView').classList.remove('hidden');
    $('signOut').classList.remove('hidden');
    loadAgents();
    startApprovalPolling();
  }
  $('signIn').addEventListener('click', function () {
    $('loginError').textContent = '';
    gqlData(Q.signIn, { u: $('username').value.trim(), p: $('password').value })
      .then(function (data) {
        token = data.communitySignIn.token;
        localStorage.setItem('nc_console_token', token);
        showApp();
      })
      .catch(function (err) { $('loginError').textContent = err.message; });
  });
  $('signOut').addEventListener('click', function () {
    token = ''; localStorage.removeItem('nc_console_token');
    location.reload();
  });
  $('langToggle').addEventListener('click', function () {
    lang = lang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('nc_console_lang', lang);
    applyCopy(); renderTab();
  });

  // ---- tabs ----
  var tabButtons = document.querySelectorAll('.tabs button');
  for (var bi = 0; bi < tabButtons.length; bi++) {
    tabButtons[bi].addEventListener('click', function (evt) {
      activeTab = evt.currentTarget.getAttribute('data-tab');
      for (var j = 0; j < tabButtons.length; j++) tabButtons[j].classList.toggle('active', tabButtons[j] === evt.currentTarget);
      renderTab();
    });
  }
  function renderTab() {
    $('tab-run').classList.toggle('hidden', activeTab !== 'run');
    $('tab-approvals').classList.toggle('hidden', activeTab !== 'approvals');
    $('tab-audit').classList.toggle('hidden', activeTab !== 'audit');
    if (activeTab === 'approvals') loadApprovals();
    if (activeTab === 'audit') loadAuditList();
  }

  // ---- run ----
  function loadAgents() {
    gqlData(Q.agents).then(function (data) {
      var select = $('agentSelect');
      select.textContent = '';
      var list = data.communityAgents || [];
      for (var i = 0; i < list.length; i++) {
        var opt = el('option', null, list[i].name + ' (' + list[i].id.slice(0, 8) + ')');
        opt.value = list[i].id;
        select.appendChild(opt);
      }
      if (!list.length) $('runError').textContent = t('audit.empty');
    }).catch(function (err) { $('runError').textContent = err.message; });
  }

  function executionCard(exec, mount) {
    var card = el('div', 'card');
    var head = el('div', 'row');
    head.appendChild(statusChip(exec.status));
    head.appendChild(el('span', 'muted mono', exec.id));
    card.appendChild(head);

    var kv = el('dl', 'kv');
    function kvAdd(k, v) { kv.appendChild(el('dt', null, k)); kv.appendChild(el('dd', null, v)); }
    kvAdd(t('exec.created'), fmtTime(exec.createdAt));
    kvAdd(t('exec.completed'), fmtTime(exec.completedAt));
    if (exec.durationMs != null) kvAdd(t('exec.duration'), exec.durationMs + ' ms');
    kvAdd(t('exec.tokens'), (exec.totalInputTokens || 0) + ' in / ' + (exec.totalOutputTokens || 0) + ' out');
    if (exec.rawInput) kvAdd(t('exec.input'), exec.rawInput);
    if (exec.outputSummary) kvAdd(t('exec.output'), exec.outputSummary);
    card.appendChild(kv);

    card.appendChild(el('h3', null, t('audit.chain.steps')));
    var steps = (exec.reactSteps || []).slice().sort(function (a, b) { return a.stepIndex - b.stepIndex; });
    if (!steps.length) card.appendChild(el('div', 'empty', '…'));
    for (var si = 0; si < steps.length; si++) {
      var s = steps[si];
      var box = el('div', 'step');
      var head2 = el('div', 'row');
      head2.appendChild(el('strong', null, '#' + s.stepIndex));
      head2.appendChild(el('span', 'chip', s.actionType));
      if (s.toolName) head2.appendChild(riskChip(s.toolName.indexOf('send') >= 0 ? 'L3' : 'L1'));
      if (s.guardrailTriggered) head2.appendChild(el('span', 'chip verdict-escalated', 'guardrail'));
      box.appendChild(head2);
      if (s.thoughtReasoning) box.appendChild(el('div', 'm', t('step.thought') + ': ' + s.thoughtReasoning));
      if (s.toolName) box.appendChild(el('div', null, t('step.action') + ': ' + s.toolName));
      if (s.observationError) box.appendChild(el('div', null, t('step.observation') + ': ' + s.observationError));
      else if (s.observationOutput != null) {
        var wrap = el('details');
        wrap.appendChild(el('summary', 'muted', t('step.observation')));
        wrap.appendChild(jsonBlock(s.observationOutput));
        box.appendChild(wrap);
      }
      card.appendChild(box);
    }

    card.appendChild(el('h3', null, t('audit.chain.tools')));
    var tools = exec.toolCallRecords || [];
    if (!tools.length) card.appendChild(el('div', 'empty', '…'));
    else {
      var table = el('table');
      var thead = el('thead'); var trh = el('tr');
      ['col.tool', 'col.status', 'col.permission', 'col.guardrail', 'col.duration', 'col.time'].forEach(function (h) {
        trh.appendChild(el('th', null, t(h)));
      });
      thead.appendChild(trh); table.appendChild(thead);
      var tbody = el('tbody');
      for (var ti = 0; ti < tools.length; ti++) {
        var tc = tools[ti]; var tr = el('tr');
        tr.appendChild(el('td', 'mono', tc.toolName));
        tr.appendChild(el('td', null, tc.status || '—'));
        var tdP = el('td'); tdP.appendChild(verdictChip('permission', tc.permissionCheck)); tr.appendChild(tdP);
        var tdG = el('td'); tdG.appendChild(verdictChip('guardrail', tc.guardrailCheck)); tr.appendChild(tdG);
        tr.appendChild(el('td', null, tc.durationMs != null ? tc.durationMs + ' ms' : '—'));
        tr.appendChild(el('td', null, fmtTime(tc.createdAt)));
        tbody.appendChild(tr);
      }
      table.appendChild(tbody); card.appendChild(table);
    }
    mount.textContent = '';
    mount.appendChild(card);
    return card;
  }

  function trackExecution(id) {
    trackExecutionId = id;
    if (pollTimer) clearInterval(pollTimer);
    var tick = function () {
      gqlData(Q.execution, { id: id }).then(function (data) {
        var exec = data.communityAgentExecution;
        if (!exec) return;
        executionCard(exec, $('runExecution'));
        if (['pending', 'running', 'guardrail_pending'].indexOf(exec.status) < 0 && pollTimer) {
          clearInterval(pollTimer); pollTimer = null;
        }
      }).catch(function () { /* transient poll failure — next tick retries */ });
    };
    tick();
    pollTimer = setInterval(tick, 1500);
  }

  $('runBtn').addEventListener('click', function () {
    $('runError').textContent = ''; $('runMsg').textContent = t('msg.running');
    var agentId = $('agentSelect').value;
    var input = $('taskInput').value.trim();
    if (!agentId || !input) { $('runError').textContent = 'EMPTY_INPUT'; return; }
    gqlData(Q.execute, { a: agentId, i: input }).then(function (data) {
      trackExecution(data.communityExecuteAgent.id);
    }).catch(function (err) { $('runError').textContent = err.message; $('runMsg').textContent = ''; });
  });

  // ---- approvals ----
  function loadApprovals() {
    gqlData(Q.pending).then(function (data) {
      renderApprovals(data.communityPendingApprovals || []);
    }).catch(function () { /* polling */ });
  }
  function renderApprovals(list) {
    var mount = $('approvalList'); mount.textContent = '';
    var btn = document.querySelector('.tabs button[data-tab="approvals"]');
    var old = btn.querySelector('.badge'); if (old) old.remove();
    if (!list.length) { mount.appendChild(el('div', 'empty', t('approvals.empty'))); return; }
    var badge = el('span', 'badge', String(list.length)); btn.appendChild(badge);
    for (var i = 0; i < list.length; i++) list[i].__i = i;
    for (var j = 0; j < list.length; j++) (function (item) {
      var card = el('div', 'approval');
      var title = el('div', 'title');
      title.appendChild(el('span', 'mono', item.toolName));
      title.appendChild(riskChip(item.riskLevel));
      title.appendChild(statusChip('guardrail_pending'));
      card.appendChild(title);
      if (item.description) card.appendChild(el('div', 'desc', item.description));
      var kv = el('dl', 'kv');
      kv.appendChild(el('dt', null, t('approvals.execution')));
      var dd = el('dd'); var link = el('a', 'mono', item.executionId); link.href = '#'; 
      link.addEventListener('click', function (evt) {
        evt.preventDefault();
        activeTab = 'run';
        for (var k = 0; k < tabButtons.length; k++) tabButtons[k].classList.toggle('active', tabButtons[k].getAttribute('data-tab') === 'run');
        renderTab(); trackExecution(item.executionId);
      });
      dd.appendChild(link); kv.appendChild(dd);
      kv.appendChild(el('dt', null, t('approvals.submittedAt')));
      kv.appendChild(el('dd', null, fmtTime(item.submittedAt)));
      card.appendChild(kv);
      card.appendChild(el('h3', null, t('step.toolInput')));
      card.appendChild(jsonBlock(item.toolInput));
      var label = el('label', null, t('approvals.decide'));
      var comment = el('input'); comment.type = 'text'; comment.style.width = '100%';
      var actions = el('div', 'row'); actions.style.marginTop = '12px';
      var okBtn = el('button', 'btn', t('approvals.approve'));
      var noBtn = el('button', 'btn danger', t('approvals.reject'));
      var msg = el('span', 'muted');
      function decide(code) {
        okBtn.disabled = true; noBtn.disabled = true;
        gqlData(Q.decide, { i: item.id, d: code, c: comment.value || null }).then(function (data) {
          msg.textContent = t('msg.decided') + data.communityDecideApproval.executionStatus;
          loadApprovals();
          if (trackExecutionId === item.executionId) trackExecution(item.executionId);
        }).catch(function (err) { msg.textContent = err.message; okBtn.disabled = false; noBtn.disabled = false; });
      }
      okBtn.addEventListener('click', function () { decide('APPROVED'); });
      noBtn.addEventListener('click', function () { decide('REJECTED'); });
      actions.appendChild(okBtn); actions.appendChild(noBtn); actions.appendChild(msg);
      card.appendChild(label); card.appendChild(comment); card.appendChild(actions);
      mount.appendChild(card);
    })(list[j]);
  }
  function startApprovalPolling() {
    if (approvalTimer) clearInterval(approvalTimer);
    approvalTimer = setInterval(function () {
      if (activeTab === 'approvals' || token) loadApprovals();
    }, 3000);
  }

  // ---- audit ----
  function loadAuditList() {
    gqlData(Q.executions, { n: 20 }).then(function (data) {
      var list = data.communityAgentExecutions || [];
      var mount = $('auditList'); mount.textContent = '';
      if (!list.length) { mount.appendChild(el('div', 'empty', t('audit.empty'))); return; }
      var table = el('table'); var thead = el('thead'); var trh = el('tr');
      ['col.status', 'exec.created', 'col.duration', 'exec.tokens', 'exec.input', 'label.view'].forEach(function (h) {
        trh.appendChild(el('th', null, t(h)));
      });
      thead.appendChild(trh); table.appendChild(thead);
      var tbody = el('tbody');
      for (var i = 0; i < list.length; i++) (function (row) {
        var tr = el('tr', 'click');
        var tdS = el('td'); tdS.appendChild(statusChip(row.status)); tr.appendChild(tdS);
        tr.appendChild(el('td', null, fmtTime(row.createdAt)));
        tr.appendChild(el('td', null, row.durationMs != null ? row.durationMs + ' ms' : '—'));
        tr.appendChild(el('td', null, (row.totalInputTokens || 0) + '/' + (row.totalOutputTokens || 0)));
        tr.appendChild(el('td', null, (row.rawInput || '').slice(0, 60)));
        tr.appendChild(el('td', null, t('label.view')));
        tr.addEventListener('click', function () { loadAuditDetail(row.id); });
        tbody.appendChild(tr);
      })(list[i]);
      table.appendChild(tbody); mount.appendChild(table);
    }).catch(function (err) {
      $('auditList').textContent = ''; $('auditList').appendChild(el('div', 'error', err.message));
    });
  }
  $('auditRefresh').addEventListener('click', loadAuditList);

  function loadAuditDetail(id) {
    Promise.all([
      gqlData(Q.execution, { id: id }),
      gqlData(Q.events, { e: id })
    ]).then(function (results) {
      var exec = results[0].communityAgentExecution;
      var events = results[1].communityExecutionEvents || [];
      var mount = $('auditDetail'); mount.textContent = '';
      executionCard(exec, mount);
      var card = mount.firstChild;
      card.appendChild(el('h3', null, t('audit.chain.events')));
      if (!events.length) card.appendChild(el('div', 'empty', '…'));
      for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        var box = el('div', 'step');
        var head = el('div', 'row');
        head.appendChild(el('strong', 'mono', ev.eventType));
        head.appendChild(el('span', 'muted', fmtTime(ev.createdAt)));
        box.appendChild(head);
        var details = el('details');
        details.appendChild(el('summary', 'muted', 'payload'));
        details.appendChild(jsonBlock(ev.payload));
        box.appendChild(details);
        card.appendChild(box);
      }
      card.scrollIntoView({ behavior: 'smooth' });
    }).catch(function (err) {
      $('auditDetail').textContent = '';
      $('auditDetail').appendChild(el('div', 'error', err.message));
    });
  }

  // ---- boot ----
  applyCopy();
  if (token) {
    gqlData(Q.agents).then(showApp).catch(function () {
      token = ''; localStorage.removeItem('nc_console_token');
    });
  }
})();
</script>
</body>
</html>
`;
