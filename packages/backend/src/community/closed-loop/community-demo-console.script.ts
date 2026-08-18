/**
 * Console client script: i18n COPY map, GraphQL client, rendering.
 *
 * Part of the single static demo console (see community-demo-console.page.ts).
 * No build toolchain: this is literal page content, assembled at runtime.
 *
 * CONSTRAINT (PROJECT_CONST §1.9): every branch/status key in this script is a
 * stable code (execution status, decision codes); user-facing strings come
 * only from the COPY map below via t(). No display string is ever used as a
 * state key. Untrusted data is rendered via textContent/createElement only —
 * no string is ever assigned to innerHTML (guard-tested).
 */
export const COMMUNITY_DEMO_CONSOLE_SCRIPT = `
(function () {
  'use strict';

  // ---- i18n copy map: display strings ONLY here, keyed by stable codes ----
  var COPY = {
    zh: {
      'app.subtitle': '社区版治理闭环控制台',
      'app.signOut': '退出',
      'app.showcase': '产品橱窗 Dashboard',
      'login.title': '登录演示工作区',
      'login.hint': '种子演示账号已预填：demo / nexusclaw-demo',
      'login.username': '用户名', 'login.password': '密码', 'login.submit': '登录',
      'tab.run': '运行', 'tab.approvals': '审批', 'tab.audit': '审计链',
      'run.hint.smoke': '确定性剧本（无需 LLM）：第一步 L1 客户查询（放行并审计）→ 第二步 L3 外发跟进邮件（暂停等待人工审批）→ 批准后继续执行完成。',
      'run.hint.byo': '当前接入你的真实模型（BYO）：治理门与确定性模式完全一致——L1 查询放行并审计，L3 发信仍会暂停等待人工审批。移除 COMMUNITY_LLM_* 环境变量可回到确定性剧本。',
      'run.agent': '数字员工', 'run.submit': '执行任务',
      'model.smoke': '确定性剧本',
      'model.byo': 'BYO 模型',
      'model.note.smoke': '当前为确定性剧本模式：无需任何 LLM 凭证，适合零依赖跑通治理闭环。想接入真实模型，请配置 COMMUNITY_LLM_BASE_URL / COMMUNITY_LLM_API_KEY / COMMUNITY_LLM_MODEL 三个环境变量后重启。',
      'model.note.byo': '当前为 BYO 真实模型模式：执行器调用你配置的 OpenAI 兼容端点，权限、护栏、审批与审计门与确定性模式完全一致。',
      'approvals.empty': '当前没有待审批项',
      'approvals.title': '待审批的敏感操作',
      'approvals.decide': '审批意见（可选，将成为该数字员工的辅导记录）',
      'approvals.approve': '批准', 'approvals.reject': '拒绝',
      'approvals.execution': '关联执行', 'approvals.submittedAt': '提交时间',
      'audit.executions': '执行记录', 'audit.refresh': '刷新',
      'audit.empty': '暂无执行记录，先到“运行”页发起一次任务',
      'audit.chain.steps': 'ReAct 步骤（react_steps）',
      'audit.chain.tools': '工具调用（tool_call_records）',
      'audit.chain.events': '事件流（outbox_events）',
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
      'app.showcase': 'Product showcase',
      'login.title': 'Sign in to the demo workspace',
      'login.hint': 'Seeded demo credentials pre-filled: demo / nexusclaw-demo',
      'login.username': 'Username', 'login.password': 'Password', 'login.submit': 'Sign in',
      'tab.run': 'Run', 'tab.approvals': 'Approvals', 'tab.audit': 'Audit chain',
      'run.hint.smoke': 'Deterministic scenario (no LLM needed): step 1 L1 customer lookup (audited, proceeds) → step 2 L3 outbound follow-up email (pauses for human approval) → after approval the run resumes and completes.',
      'run.hint.byo': 'Your real model is wired in (BYO): governance gates are identical to the deterministic mode — the L1 lookup proceeds and is audited, the L3 email still pauses for human approval. Remove the COMMUNITY_LLM_* environment variables to return to the deterministic scenario.',
      'run.agent': 'Digital employee', 'run.submit': 'Run task',
      'model.smoke': 'Deterministic scenario',
      'model.byo': 'BYO model',
      'model.note.smoke': 'Deterministic scenario mode: no LLM credential is required — run the governed closed loop with zero dependencies. To wire a real model, set COMMUNITY_LLM_BASE_URL / COMMUNITY_LLM_API_KEY / COMMUNITY_LLM_MODEL and restart.',
      'model.note.byo': 'BYO real-model mode: the executor calls your configured OpenAI-compatible endpoint. Permissions, guardrails, approvals and the audit chain are identical to the deterministic mode.',
      'approvals.empty': 'No pending approvals',
      'approvals.title': 'Pending sensitive operations',
      'approvals.decide': 'Comment (optional — becomes a coaching record for this digital employee)',
      'approvals.approve': 'Approve', 'approvals.reject': 'Reject',
      'approvals.execution': 'Execution', 'approvals.submittedAt': 'Submitted at',
      'audit.executions': 'Executions', 'audit.refresh': 'Refresh',
      'audit.empty': 'No executions yet — run a task first',
      'audit.chain.steps': 'ReAct steps (react_steps)',
      'audit.chain.tools': 'Tool calls (tool_call_records)',
      'audit.chain.events': 'Event stream (outbox_events)',
      'common.back': 'Back', 'common.retry': 'Retrying…',
      'status.pending': 'Pending', 'status.running': 'Running',
      'status.guardrail_pending': 'Awaiting approval', 'status.done': 'Done',
      'status.failed': 'Failed', 'status.timeout': 'Timeout', 'status.cancelled': 'Cancelled',
      'exec.input': 'Input', 'exec.output': 'Output summary', 'exec.created': 'Created at',
      'exec.completed': 'Completed at', 'exec.duration': 'Duration', 'exec.tokens': 'Tokens',
      'step.thought': 'Thought', 'step.action': 'Action', 'step.observation': 'Observation',
      'step.toolInput': 'Tool input', 'step.output': 'Result',
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

  // ---- model source (deterministic smoke | byo env) ----
  var modelKind = 'smoke';
  function applyModelSource(ms) {
    if (!ms || !ms.kind) return;
    modelKind = ms.kind === 'byo_env' ? 'byo' : 'smoke';
    var badge = $('modelBadge');
    badge.classList.remove('hidden', 'm-smoke', 'm-byo');
    badge.classList.add(modelKind === 'byo' ? 'm-byo' : 'm-smoke');
    badge.textContent = modelKind === 'byo'
      ? t('model.byo') + ' · ' + (ms.modelId || '?')
      : t('model.smoke');
    applyRunHint();
  }
  function loadModelSource() {
    gqlData(Q.modelSource).then(function (data) {
      applyModelSource(data.communityModelSource);
    }).catch(function () { /* badge simply stays hidden */ });
  }
  function applyRunHint() {
    var hint = $('runHint');
    if (hint) hint.textContent = t(modelKind === 'byo' ? 'run.hint.byo' : 'run.hint.smoke');
  }
  function toggleModelNote() {
    var note = $('modelNote');
    if (note.classList.contains('hidden')) {
      note.textContent = t(modelKind === 'byo' ? 'model.note.byo' : 'model.note.smoke');
      note.classList.remove('hidden');
    } else {
      note.classList.add('hidden');
    }
  }

  function applyCopy() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    $('langToggle').textContent = lang === 'zh' ? 'EN' : '中文';
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    applyRunHint();
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
  function fmtTime(value) {
    if (!value) return '—';
    try { return new Date(value).toLocaleString(); } catch (e) { return String(value); }
  }

  // ---- JSON syntax highlight (createElement/textColor only, never innerHTML) ----
  var JSON_TOKEN = /("(?:[^"\\\\]|\\\\.)*")(\\s*:)?|\\b(true|false|null)\\b|(-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)/g;
  function jsonBlock(value) {
    var pre = el('pre', 'json');
    var text;
    try { text = JSON.stringify(value, null, 2); } catch (e) { text = String(value); }
    if (text == null) text = String(value);
    var last = 0, m;
    JSON_TOKEN.lastIndex = 0;
    while ((m = JSON_TOKEN.exec(text)) !== null) {
      if (m.index > last) pre.appendChild(document.createTextNode(text.slice(last, m.index)));
      var cls;
      if (m[1] != null) cls = m[2] != null ? 'hl-key' : 'hl-str';
      else if (m[3] != null) cls = m[0] === 'null' ? 'hl-null' : 'hl-bool';
      else cls = 'hl-num';
      pre.appendChild(el('span', cls, m[0]));
      last = m.index + m[0].length;
    }
    if (last < text.length) pre.appendChild(document.createTextNode(text.slice(last)));
    return pre;
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
    events: 'query V($e: ID!) { communityExecutionEvents(executionId: $e) { id eventType payload createdAt } }',
    modelSource: 'query M { communityModelSource { kind modelId providerKind } }'
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
    loadModelSource();
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
  $('modelBadge').addEventListener('click', toggleModelNote);
  $('modelBadge').addEventListener('keydown', function (evt) {
    if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); toggleModelNote(); }
  });

  // ---- tabs (roving tabindex + arrow keys) ----
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.tabs button'));
  function activateTab(name, focus) {
    activeTab = name;
    for (var j = 0; j < tabButtons.length; j++) {
      var b = tabButtons[j];
      var sel = b.getAttribute('data-tab') === name;
      b.classList.toggle('active', sel);
      b.setAttribute('aria-selected', sel ? 'true' : 'false');
      b.tabIndex = sel ? 0 : -1;
    }
    renderTab();
    if (focus) b = $('tabbtn-' + name), b.focus();
  }
  for (var bi = 0; bi < tabButtons.length; bi++) {
    tabButtons[bi].addEventListener('click', function (evt) {
      activateTab(evt.currentTarget.getAttribute('data-tab'), false);
    });
  }
  document.querySelector('.tabs').addEventListener('keydown', function (evt) {
    var idx = tabButtons.indexOf(document.activeElement);
    if (idx < 0) return;
    var next = -1;
    if (evt.key === 'ArrowRight') next = (idx + 1) % tabButtons.length;
    else if (evt.key === 'ArrowLeft') next = (idx - 1 + tabButtons.length) % tabButtons.length;
    else if (evt.key === 'Home') next = 0;
    else if (evt.key === 'End') next = tabButtons.length - 1;
    if (next >= 0) {
      evt.preventDefault();
      activateTab(tabButtons[next].getAttribute('data-tab'), true);
    }
  });
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

  // ---- audit timeline renderer (shared by run tracking and audit detail) ----
  function timelineNode(buildHead, buildBody, opts) {
    var node = el('div', 'node'
      + (opts && opts.collapsed ? ' collapsed' : '')
      + (opts && opts.tone ? ' n-' + opts.tone : ''));
    var head = el('button', 'node-head');
    head.type = 'button';
    head.setAttribute('aria-expanded', opts && opts.collapsed ? 'false' : 'true');
    head.appendChild(el('span', 'caret', '▾'));
    buildHead(head);
    head.addEventListener('click', function () {
      var collapsed = node.classList.toggle('collapsed');
      head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });
    var body = el('div', 'node-body');
    buildBody(body);
    node.appendChild(head);
    node.appendChild(body);
    return node;
  }
  function pair(parent, label, value) {
    var box = el('div', 'pair');
    box.appendChild(el('span', 'm', label));
    box.appendChild(value);
    parent.appendChild(box);
    return box;
  }
  function renderAuditTimeline(exec, events, mount, opts) {
    opts = opts || {};
    mount.textContent = '';
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
    var tl = el('div', 'timeline');
    var steps = (exec.reactSteps || []).slice().sort(function (a, b) { return a.stepIndex - b.stepIndex; });
    var tools = exec.toolCallRecords || [];
    var toolPtr = 0;
    var expandSteps = !!opts.expandSteps;
    if (!steps.length) tl.appendChild(el('div', 'empty', '…'));
    for (var si = 0; si < steps.length; si++) {
      (function (s) {
        var risk = s.toolName ? (s.toolName.indexOf('send') >= 0 ? 'L3' : 'L1') : null;
        var tone = s.observationError ? 'err' : (risk === 'L3' ? 'warn' : null);
        var node = timelineNode(function (h) {
          h.appendChild(el('strong', null, '#' + s.stepIndex));
          h.appendChild(el('span', 'chip action-type', s.actionType));
          if (risk) h.appendChild(riskChip(risk));
          if (s.guardrailTriggered) h.appendChild(el('span', 'chip verdict-escalated', 'guardrail'));
        }, function (b) {
          if (s.thoughtReasoning) pair(b, t('step.thought'), el('span', null, s.thoughtReasoning));
          if (s.toolName) pair(b, t('step.action'), el('span', 'mono', s.toolName));
          if (s.toolInput != null) pair(b, t('step.toolInput'), jsonBlock(s.toolInput));
          var rec = null;
          while (toolPtr < tools.length) {
            if (tools[toolPtr].toolName === s.toolName) { rec = tools[toolPtr]; toolPtr++; break; }
            toolPtr++;
          }
          if (rec) {
            var chips = el('div', 'row');
            var p = verdictChip('permission', rec.permissionCheck);
            var g = verdictChip('guardrail', rec.guardrailCheck);
            chips.appendChild(p); chips.appendChild(g);
            if (rec.durationMs != null) chips.appendChild(el('span', 'muted', rec.durationMs + ' ms'));
            pair(b, t('audit.chain.tools'), chips);
            if (rec.output != null) pair(b, t('step.output'), jsonBlock(rec.output));
          }
          if (s.observationError) pair(b, t('step.observation'), el('span', 'error', s.observationError));
          else if (s.observationOutput != null) pair(b, t('step.observation'), jsonBlock(s.observationOutput));
        }, { collapsed: !expandSteps, tone: tone });
        tl.appendChild(node);
      })(steps[si]);
    }
    card.appendChild(tl);

    card.appendChild(el('h3', null, t('audit.chain.tools')));
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

    if (events && events.length) {
      card.appendChild(el('h3', null, t('audit.chain.events')));
      var evTl = el('div', 'timeline');
      for (var ei = 0; ei < events.length; ei++) {
        (function (ev) {
          evTl.appendChild(timelineNode(function (h) {
            h.appendChild(el('strong', 'mono', ev.eventType));
            h.appendChild(el('span', 'muted', fmtTime(ev.createdAt)));
          }, function (b) {
            pair(b, 'payload', jsonBlock(ev.payload));
          }, { collapsed: true }));
        })(events[ei]);
      }
      card.appendChild(evTl);
    }

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
        renderAuditTimeline(exec, null, $('runExecution'), { expandSteps: true });
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
        activateTab('run', false);
        trackExecution(item.executionId);
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
          card.classList.add('resolved');
          setTimeout(loadApprovals, 400);
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
      var mount = $('auditDetail');
      renderAuditTimeline(exec, events, mount, { expandSteps: false });
      mount.firstChild.scrollIntoView({ behavior: 'smooth' });
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
`;
