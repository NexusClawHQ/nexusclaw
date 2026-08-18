/**
 * The playground landing page — a single static page, no build toolchain and
 * no host filesystem reads. Served at GET /playground when
 * PLAYGROUND_PROFILE=true.
 *
 * Invariants (same as the /console page): display strings come only from the
 * COPY map; untrusted data renders via textContent/createElement only; zero
 * external resources. The session token lives in a JS variable — refreshing
 * the page starts a fresh session (sessions are throwaway by design).
 */
export const PLAYGROUND_PAGE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>NexusClaw Playground</title>
<style>
  :root {
    --bg:#f5f7fa; --panel:#ffffff; --panel-2:#f2f5f9; --border:#e5e9f0; --border-strong:#d4dae4;
    --text:#17233d; --muted:#68738a; --faint:#98a1b3;
    --accent:#3056d3; --accent-soft:#edf1fe;
    --ok:#0f7a4a; --ok-soft:#e6f5ee; --info:#1d4fd8; --info-soft:#e8effd;
    --warn:#9a6408; --warn-soft:#fdf3e0; --bad:#b33131; --bad-soft:#fbeaea;
    --json-bg:#0f1626; --json-ink:#d7e0f5;
    --radius-sm:6px; --radius-md:10px; --radius-lg:14px;
    --shadow-1:0 1px 2px rgba(23,35,61,.05); --shadow-2:0 6px 24px rgba(23,35,61,.08);
    font-family:-apple-system,"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-size:13.5px; line-height:1.6; }
  .mono { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12px; }
  .wrap { max-width:880px; margin:0 auto; padding:20px 24px 56px; display:flex; flex-direction:column; gap:14px; }
  .hero {
    background:radial-gradient(700px 300px at 15% -20%,#edf1fe 0%,transparent 60%),radial-gradient(560px 260px at 95% -10%,#e6f5ee 0%,transparent 55%),var(--panel);
    border:1px solid var(--border); border-radius:var(--radius-lg); box-shadow:var(--shadow-1);
    padding:32px 36px; text-align:center;
  }
  .brandrow { display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:8px; }
  .brandmark { width:30px; height:30px; border-radius:8px; background:linear-gradient(135deg,#3056d3,#6a8dff); color:#fff; font-weight:700; display:flex; align-items:center; justify-content:center; }
  .hero h1 { margin:0; font-size:24px; font-weight:700; }
  .hero .sub { margin:8px auto 0; max-width:540px; color:var(--muted); font-size:13.5px; }
  .run-btn { margin:16px auto 0; display:inline-flex; align-items:center; gap:8px; background:var(--accent); color:#fff; border:none; border-radius:var(--radius-sm); padding:11px 30px; font:inherit; font-size:14.5px; font-weight:650; cursor:pointer; box-shadow:var(--shadow-2); }
  .run-btn:disabled { opacity:.55; cursor:default; }
  .steps { display:flex; gap:10px; margin-top:18px; text-align:left; }
  .step { flex:1; background:var(--panel); border:1px solid var(--border); border-radius:var(--radius-md); padding:9px 11px; font-size:12px; color:var(--muted); }
  .step b { display:block; color:var(--text); }
  .card { background:var(--panel); border:1px solid var(--border); border-radius:var(--radius-md); box-shadow:var(--shadow-1); padding:18px; }
  .card h3 { margin:0 0 10px; font-size:14px; }
  .chip { display:inline-flex; align-items:center; border-radius:999px; padding:0 10px; font-size:11.5px; font-weight:600; line-height:1.7; white-space:nowrap; }
  .chip.ok { color:var(--ok); background:var(--ok-soft); }
  .chip.info { color:var(--info); background:var(--info-soft); }
  .chip.warn { color:var(--warn); background:var(--warn-soft); }
  .chip.bad { color:var(--bad); background:var(--bad-soft); }
  .chip.muted { color:var(--muted); background:var(--panel-2); border:1px solid var(--border); }
  .ptl { list-style:none; margin:0; padding:0 0 0 16px; border-left:2px solid var(--border); display:flex; flex-direction:column; gap:12px; }
  .pnode { position:relative; display:flex; flex-direction:column; gap:5px; }
  .pnode::before { content:""; position:absolute; left:-21px; top:7px; width:9px; height:9px; border-radius:50%; background:var(--panel); border:2.5px solid var(--accent); }
  .pnode.tone-ok::before { border-color:var(--ok); }
  .pnode.tone-warn::before { border-color:var(--warn); }
  .pnode.tone-muted::before { border-color:var(--border-strong); }
  .phead { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-weight:600; }
  .desc { color:var(--muted); font-size:12px; margin:0; }
  .approve-box { border:1px solid #ecd9b0; background:var(--warn-soft); border-radius:var(--radius-sm); padding:10px 12px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .btn { display:inline-flex; align-items:center; gap:6px; background:#fff; border:1px solid var(--border-strong); border-radius:var(--radius-sm); color:var(--text); padding:7px 14px; font:inherit; font-size:12.5px; cursor:pointer; }
  .btn.approve { background:var(--ok-soft); border-color:#9fd4bd; color:var(--ok); font-weight:600; }
  .btn.reject { background:var(--bad-soft); border-color:#e3b3b3; color:var(--bad); font-weight:600; }
  .btn:disabled { opacity:.5; cursor:default; }
  pre.json { background:var(--json-bg); color:var(--json-ink); border-radius:var(--radius-sm); padding:10px; margin:4px 0; max-height:170px; overflow:auto; white-space:pre-wrap; word-break:break-all; font-size:11.5px; font-family:ui-monospace,Menlo,monospace; }
  .cta-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
  .cta { border:1px solid var(--border); border-radius:var(--radius-md); background:var(--panel); padding:12px; display:flex; flex-direction:column; gap:5px; box-shadow:var(--shadow-1); font-size:12.5px; }
  .cmd { background:var(--json-bg); color:var(--json-ink); border-radius:var(--radius-sm); padding:6px 9px; font-family:ui-monospace,Menlo,monospace; font-size:11px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .copy { background:transparent; border:1px solid rgba(215,224,245,.4); color:#d7e0f5; border-radius:4px; padding:1px 8px; font-size:11px; cursor:pointer; }
  footer { text-align:center; color:var(--faint); font-size:11.5px; }
  .error { color:var(--bad); font-size:12.5px; white-space:pre-wrap; }
  .hidden { display:none !important; }
  a { color:var(--accent); }
  @media (max-width:720px) { .steps { flex-direction:column; } .cta-grid { grid-template-columns:1fr; } }
</style>
</head>
<body>
<div class="wrap">
  <div style="display:flex;justify-content:flex-end"><button class="btn" id="langToggle">English</button></div>
  <header class="hero">
    <div class="brandrow"><span class="brandmark">N</span><span style="font-weight:700">NexusClaw Playground</span></div>
    <h1 id="t-heroTitle"></h1>
    <p class="sub" id="t-heroSub"></p>
    <button class="run-btn" id="runBtn">▶ <span id="t-run"></span></button>
    <div class="steps">
      <div class="step"><b id="t-s1b"></b><span id="t-s1"></span></div>
      <div class="step"><b id="t-s2b"></b><span id="t-s2"></span></div>
      <div class="step"><b id="t-s3b"></b><span id="t-s3"></span></div>
    </div>
  </header>

  <section class="card hidden" id="runCard">
    <h3><span id="t-live"></span> <span id="statusChip"></span></h3>
    <ol class="ptl" id="timeline"></ol>
    <div class="error" id="runError"></div>
  </section>

  <section class="card hidden" id="auditCard">
    <h3><span id="t-audit"></span> <span class="chip info" id="t-auditChip"></span></h3>
    <ol class="ptl" id="auditList"></ol>
  </section>

  <section class="cta-grid">
    <div class="cta">
      <b id="t-cta1b"></b><span id="t-cta1"></span>
      <a href="https://github.com/NexusClawHQ/nexusclaw-agent-governance" id="ghLink">nexusclaw-agent-governance ↗</a>
    </div>
    <div class="cta">
      <b id="t-cta2b"></b>
      <div class="cmd"><span>docker compose up --build</span><button class="copy" data-copy="docker compose up --build" id="t-copy1"></button></div>
      <div class="cmd"><span>open http://localhost:3000/app</span><button class="copy" data-copy="open http://localhost:3000/app" id="t-copy2"></button></div>
    </div>
  </section>

  <footer id="t-footer"></footer>
</div>
<script>
(function () {
  'use strict';
  var COPY = {
    zh: {
      'hero.title': '60 秒，跑一次真实的 AI 治理闭环',
      'hero.sub': '无需注册、无需安装。真实的权限 · 护栏 · 审批 · 审计管线，确定性剧本，无任何真实外发。',
      'run': '运行治理闭环',
      's1b': '① 点击运行', 's1': '自动创建一次性会话',
      's2b': '② L3 暂停时你来批准', 's2': '体验人工治理门',
      's3b': '③ 查看审计链', 's3': '四层证据全程可查',
      'live': '实时执行',
      'audit': '审计链', 'audit.chip': '四层证据',
      'n.session': '会话就绪', 'n.session.desc': '一次性工作区已创建，30 分钟后自动清理。',
      'n.l1': 'L1 · 客户查询', 'n.l1.desc': '只读查询放行并写入审计——C-1001 · Acme Robotics。',
      'n.l3': 'L3 · 外发邮件', 'n.l3.desc': '收件人：C-1001 · 主题：Follow-up: service check-in（干跑，无真实发送）',
      'n.done': '执行完成', 'n.done.desc': '批准后执行恢复并完成，审计链如下。',
      'n.fail': '执行失败',
      'approve.wait': '跟进邮件草稿已就绪，等待人工批准',
      'approve': '批准', 'reject': '拒绝',
      'st.running': '运行中…', 'st.pending': 'L3 等待你的批准', 'st.done': '已完成', 'st.failed': '失败',
      'cta1b': '★ GitHub 仓库', 'cta1': 'Apache-2.0 · 治理内核 9 个 npm 包',
      'cta2b': '⌘ 自托管参考实现',
      'copy': '复制', 'copied': '已复制',
      'footer': '会话 30 分钟无活动自动清理 · 无注册 · 确定性剧本（无 LLM、无真实外发）',
      'err.session': '会话创建失败，请稍后再试，或按下方指引自托管完整版。',
      'err.exec': '执行失败，请稍后再试。'
    },
    en: {
      'hero.title': 'Run a real governed AI loop in 60 seconds',
      'hero.sub': 'No signup, no install. Real permissions · guardrails · approvals · audit pipeline, deterministic scenario, nothing real is sent.',
      'run': 'Run the governed loop',
      's1b': '① Click run', 's1': 'A throwaway session is created',
      's2b': '② You approve the L3 pause', 's2': 'Feel the human gate yourself',
      's3b': '③ Inspect the audit chain', 's3': 'Four layers of evidence',
      'live': 'Live execution',
      'audit': 'Audit chain', 'audit.chip': 'four layers',
      'n.session': 'Session ready', 'n.session.desc': 'Ephemeral workspace created; auto-recycled after 30 minutes.',
      'n.l1': 'L1 · customer lookup', 'n.l1.desc': 'Read-only lookup proceeds and is audited — C-1001 · Acme Robotics.',
      'n.l3': 'L3 · outbound email', 'n.l3.desc': 'To: C-1001 · Subject: Follow-up: service check-in (dry-run, nothing sent)',
      'n.done': 'Execution complete', 'n.done.desc': 'Resumed after your approval; audit chain below.',
      'n.fail': 'Execution failed',
      'approve.wait': 'Follow-up email draft ready — waiting for human approval',
      'approve': 'Approve', 'reject': 'Reject',
      'st.running': 'running…', 'st.pending': 'L3 awaiting your approval', 'st.done': 'done', 'st.failed': 'failed',
      'cta1b': '★ GitHub repo', 'cta1': 'Apache-2.0 · 9 governance npm packages',
      'cta2b': '⌘ Self-host the reference implementation',
      'copy': 'copy', 'copied': 'copied',
      'footer': 'Sessions auto-recycle after 30 idle minutes · no signup · deterministic scenario (no LLM, no real outbound)',
      'err.session': 'Session creation failed — try later or self-host via the commands below.',
      'err.exec': 'Execution failed — try again later.'
    }
  };
  var lang = (navigator.language || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
  function t(k) { var m = COPY[lang]; return m[k] != null ? m[k] : k; }
  function apply() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.getElementById('t-heroTitle').textContent = t('hero.title');
    document.getElementById('t-heroSub').textContent = t('hero.sub');
    document.getElementById('t-run').textContent = t('run');
    document.getElementById('t-s1b').textContent = t('s1b'); document.getElementById('t-s1').textContent = t('s1');
    document.getElementById('t-s2b').textContent = t('s2b'); document.getElementById('t-s2').textContent = t('s2');
    document.getElementById('t-s3b').textContent = t('s3b'); document.getElementById('t-s3').textContent = t('s3');
    document.getElementById('t-live').textContent = t('live');
    document.getElementById('t-audit').textContent = t('audit');
    document.getElementById('t-auditChip').textContent = t('audit.chip');
    document.getElementById('t-cta1b').textContent = t('cta1b'); document.getElementById('t-cta1').textContent = t('cta1');
    document.getElementById('t-cta2b').textContent = t('cta2b');
    document.getElementById('t-copy1').textContent = t('copy'); document.getElementById('t-copy2').textContent = t('copy');
    document.getElementById('t-footer').textContent = t('footer');
    document.getElementById('langToggle').textContent = lang === 'zh' ? 'English' : '中文';
  }
  document.getElementById('langToggle').addEventListener('click', function () { lang = lang === 'zh' ? 'en' : 'zh'; apply(); });
  for (var ci = 0; ci < 2; ci++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        try { navigator.clipboard.writeText(btn.getAttribute('data-copy')); } catch (e) {}
        btn.textContent = t('copied');
        setTimeout(function () { btn.textContent = t('copy'); }, 1500);
      });
    })(document.getElementsByClassName('copy')[ci]);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function chip(kind, text) { return el('span', 'chip ' + kind, text); }
  function node(tone, buildHead, desc) {
    var li = el('li', 'pnode tone-' + tone);
    var head = el('div', 'phead');
    buildHead(head);
    li.appendChild(head);
    if (desc) li.appendChild(el('p', 'desc', desc));
    return li;
  }
  function jsonBlock(value) {
    var pre = el('pre', 'json');
    try { pre.textContent = JSON.stringify(value, null, 2); } catch (e) { pre.textContent = String(value); }
    return pre;
  }

  var token = '';
  var agentId = '';
  var executionId = '';
  var pollTimer = null;

  function gql(query, variables) {
    return fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ query: query, variables: variables || {} })
    }).then(function (res) { return res.json(); });
  }

  function setStatus(kind, text) {
    var mount = document.getElementById('statusChip');
    mount.className = 'chip ' + kind;
    mount.textContent = text;
  }

  function renderTimeline(exec) {
    var tl = document.getElementById('timeline');
    tl.textContent = '';
    tl.appendChild(node('ok', function (h) {
      h.appendChild(chip('ok', t('n.session')));
      h.appendChild(el('span', 'mono', 'pg_session'));
    }, t('n.session.desc')));
    var steps = (exec.reactSteps || []).slice().sort(function (a, b) { return a.stepIndex - b.stepIndex; });
    var approved = (exec.toolCallRecords || []).some(function (tc) { return tc.toolName.indexOf('send') >= 0; });
    for (var i = 0; i < steps.length; i++) {
      (function (s) {
        var isL3 = s.toolName && s.toolName.indexOf('send') >= 0;
        var paused = isL3 && exec.status === 'guardrail_pending';
        var li = node(paused ? 'warn' : (s.observationError ? 'bad' : 'ok'), function (h) {
          h.appendChild(chip(isL3 ? 'warn' : 'info', isL3 ? t('n.l3') : t('n.l1')));
          if (s.toolName) h.appendChild(el('span', 'mono', s.toolName));
          if (isL3) h.appendChild(chip('warn', 'requires approval'));
        }, isL3 ? t('n.l3.desc') : t('n.l1.desc'));
        if (s.toolInput != null) li.appendChild(jsonBlock(s.toolInput));
        tl.appendChild(li);
        if (paused) {
          var box = el('div', 'approve-box');
          var left = el('div'); left.style.flex = '1'; left.style.minWidth = '200px';
          left.appendChild(el('b', null, t('approve.wait')));
          var ok = el('button', 'btn approve', '✓ ' + t('approve'));
          var no = el('button', 'btn reject', '✕ ' + t('reject'));
          ok.addEventListener('click', function () { decide('APPROVED', ok, no); });
          no.addEventListener('click', function () { decide('REJECTED', ok, no); });
          box.appendChild(left); box.appendChild(ok); box.appendChild(no);
          li.appendChild(box);
        }
      })(steps[i]);
    }
    if (['done'].indexOf(exec.status) >= 0) {
      tl.appendChild(node('ok', function (h) { h.appendChild(chip('ok', t('n.done'))); }, t('n.done.desc')));
    }
    if (['failed', 'timeout', 'cancelled'].indexOf(exec.status) >= 0) {
      tl.appendChild(node('bad', function (h) { h.appendChild(chip('bad', t('n.fail'))); }, exec.outputSummary || ''));
    }
    void approved;
  }

  function renderAudit(exec) {
    var card = document.getElementById('auditCard');
    card.classList.remove('hidden');
    var list = document.getElementById('auditList');
    list.textContent = '';
    (exec.toolCallRecords || []).forEach(function (tc) {
      var li = node(tc.guardrailCheck === 'escalated' ? 'warn' : 'ok', function (h) {
        h.appendChild(el('span', 'mono', tc.toolName));
        h.appendChild(chip('info', tc.status || ''));
        h.appendChild(chip(tc.permissionCheck === 'passed' ? 'ok' : 'bad', 'permission ' + (tc.permissionCheck || '')));
        h.appendChild(chip(tc.guardrailCheck === 'passed' ? 'ok' : 'warn', 'guardrail ' + (tc.guardrailCheck || '')));
      });
      if (tc.input != null) li.appendChild(jsonBlock(tc.input));
      list.appendChild(li);
    });
    card.scrollIntoView({ behavior: 'smooth' });
  }

  function decide(code, okBtn, noBtn) {
    okBtn.disabled = true; noBtn.disabled = true;
    gql('query P { communityPendingApprovals { id } }', {}).then(function (body) {
      var list = (body.data && body.data.communityPendingApprovals) || [];
      if (!list.length) return;
      return gql('mutation D($i: ID!, $d: String!) { communityDecideApproval(instanceId: $i, decision: $d, comment: \\'playground visitor\\') { executionStatus } }',
        { i: list[0].id, d: code }).then(function () { tick(); });
    }).catch(function () { okBtn.disabled = false; noBtn.disabled = false; });
  }

  var Q_EXEC = 'query X($id: ID!) { communityAgentExecution(id: $id) { id status outputSummary reactSteps { id stepIndex toolName toolInput observationError } toolCallRecords { id toolName status permissionCheck guardrailCheck input } } }';

  function tick() {
    gql(Q_EXEC, { id: executionId }).then(function (body) {
      var exec = body.data && body.data.communityAgentExecution;
      if (!exec) return;
      renderTimeline(exec);
      if (exec.status === 'guardrail_pending') setStatus('warn', t('st.pending'));
      else if (exec.status === 'done') {
        setStatus('ok', t('st.done'));
        renderAudit(exec);
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      } else if (['failed', 'timeout', 'cancelled'].indexOf(exec.status) >= 0) {
        setStatus('bad', t('st.failed'));
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      } else setStatus('info', t('st.running'));
    }).catch(function () {});
  }

  document.getElementById('runBtn').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    document.getElementById('runError').textContent = '';
    document.getElementById('auditCard').classList.add('hidden');
    fetch('/playground/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (res) { if (!res.ok) throw new Error('session'); return res.json(); })
      .then(function (session) {
        token = session.token; agentId = session.agentId;
        document.getElementById('runCard').classList.remove('hidden');
        setStatus('info', t('st.running'));
        return gql('mutation E($a: ID!, $i: String!) { communityExecuteAgent(agentId: $a, input: $i) { id status } }',
          { a: agentId, i: 'Look up customer C-1001 and send a follow-up email.' });
      })
      .then(function (body) {
        if (body.errors && body.errors.length) throw new Error(body.errors[0].message);
        executionId = body.data.communityExecuteAgent.id;
        if (pollTimer) clearInterval(pollTimer);
        tick();
        pollTimer = setInterval(tick, 1500);
      })
      .catch(function (err) {
        document.getElementById('runError').textContent =
          (String(err && err.message).indexOf('session') === 0 ? t('err.session') : t('err.exec'));
        btn.disabled = false;
      })
      .then(function () { btn.disabled = false; });
  });

  apply();
})();
</script>
</body>
</html>
`;
