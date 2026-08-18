/**
 * Console document body markup (login, tabs, views).
 *
 * Part of the single static demo console (see community-demo-console.page.ts).
 * No build toolchain: this is literal page content, assembled at runtime.
 */
export const COMMUNITY_DEMO_CONSOLE_BODY = `
<header>
  <span class="brandmark" aria-hidden="true">N</span>
  <span class="brand">NexusClaw</span>
  <span class="sub" data-i18n="app.subtitle"></span>
  <span class="model-badge m-smoke hidden" id="modelBadge" role="button" tabindex="0"></span>
  <span class="spacer"></span>
  <a class="head-link" href="/app" data-i18n="app.showcase"></a>
  <button id="langToggle"></button>
  <button id="signOut" class="hidden" data-i18n="app.signOut"></button>
</header>
<div class="model-note hidden" id="modelNote"></div>
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
    <div class="tabs" role="tablist" aria-label="console views">
      <button data-tab="run" role="tab" aria-selected="true" aria-controls="tab-run" id="tabbtn-run" class="active" data-i18n="tab.run"></button>
      <button data-tab="approvals" role="tab" aria-selected="false" aria-controls="tab-approvals" id="tabbtn-approvals" tabindex="-1" data-i18n="tab.approvals"></button>
      <button data-tab="audit" role="tab" aria-selected="false" aria-controls="tab-audit" id="tabbtn-audit" tabindex="-1" data-i18n="tab.audit"></button>
    </div>

    <div id="tab-run" role="tabpanel" aria-labelledby="tabbtn-run">
      <div class="card">
        <div class="hint" id="runHint"></div>
        <div class="row" style="margin-bottom:10px;">
          <label for="agentSelect" data-i18n="run.agent"></label>
          <select id="agentSelect"></select>
        </div>
        <textarea id="taskInput" aria-label="task input"></textarea>
        <div class="row" style="margin-top:10px;">
          <button class="btn" id="runBtn" data-i18n="run.submit"></button>
          <span class="muted" id="runMsg"></span>
        </div>
        <div class="error" id="runError"></div>
      </div>
      <div id="runExecution"></div>
    </div>

    <div id="tab-approvals" role="tabpanel" aria-labelledby="tabbtn-approvals" class="hidden">
      <div id="approvalList"><div class="empty" data-i18n="approvals.empty"></div></div>
    </div>

    <div id="tab-audit" role="tabpanel" aria-labelledby="tabbtn-audit" class="hidden">
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
`;
