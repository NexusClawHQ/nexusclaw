/**
 * Console stylesheet — design tokens + component styles.
 *
 * Part of the single static demo console (see community-demo-console.page.ts).
 * No build toolchain: this is literal page content, assembled at runtime.
 * Constraint: zero external resources — no fonts, CDNs, imports or url()
 * references of any kind (guard-tested).
 */
export const COMMUNITY_DEMO_CONSOLE_STYLES = `
  /* ---- design tokens (unified table, spec showcase-visual-refinement §2) ---- */
  :root {
    /* surfaces & ink */
    --bg: #f5f7fa; --card: #ffffff; --ink: #17233d; --muted: #68738a;
    --line: #e5e9f0; --line-strong: #d4dae4;
    /* brand */
    --brand: #3056d3; --brand-ink: #ffffff; --brand-soft: #edf1fe;
    /* semantics */
    --ok: #0f7a4a; --ok-bg: #e6f5ee;
    --warn: #9a6408; --warn-bg: #fdf3e0;
    --err: #b33131; --err-bg: #fbeaea;
    --idle: #68738a; --idle-bg: #f2f5f9;
    --run: #1d4fd8; --run-bg: #e8effd;
    /* timeline */
    --tl-line: #d7dce6; --tl-dot: #ffffff; --tl-dot-ring: #3056d3;
    /* json highlighting */
    --json-bg: #0f1626; --json-ink: #d7e0f5;
    --hl-key: #8ab4ff; --hl-str: #9ad7a0; --hl-num: #f0b875; --hl-bool: #e0a3e0; --hl-null: #9aa6bd;
    /* scale */
    --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 20px; --sp-6: 24px; --sp-7: 32px;
    --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px;
    --shadow-1: 0 1px 2px rgba(23, 35, 61, .05);
    --shadow-2: 0 6px 24px rgba(23, 35, 61, .08);
    --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.6 -apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif; background: var(--bg); color: var(--ink); font-variant-numeric: tabular-nums; }
  a { color: var(--brand); }

  /* ---- header ---- */
  header { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-5); background: #101728; color: #fff; position: sticky; top: 0; z-index: 10; }
  .brandmark { width: 26px; height: 26px; border-radius: var(--radius-sm); background: linear-gradient(135deg, #3056d3, #6a8dff); color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 14px; }
  header .brand { font-weight: 700; letter-spacing: .3px; }
  header .sub { opacity: .65; font-size: 12px; }
  header .spacer { flex: 1; }
  header button, header a.head-link { background: transparent; border: 1px solid rgba(255,255,255,.35); color: #fff; border-radius: var(--radius-sm); padding: 4px 10px; cursor: pointer; font-size: 12px; text-decoration: none; }
  header button:hover, header a.head-link:hover { border-color: rgba(255,255,255,.7); }
  .model-badge { border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .model-badge.m-smoke { color: var(--idle); background: var(--idle-bg); }
  .model-badge.m-byo { color: var(--run); background: var(--run-bg); }
  .model-note { background: var(--brand-soft); color: var(--brand); border-bottom: 1px solid var(--line); padding: var(--sp-2) var(--sp-5); font-size: 13px; }

  main { max-width: 1180px; margin: var(--sp-5) auto; padding: 0 var(--sp-4); }

  /* ---- tabs ---- */
  .tabs { display: flex; gap: var(--sp-1); margin-bottom: var(--sp-4); background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: var(--sp-1); box-shadow: var(--shadow-1); }
  .tabs button { font: inherit; padding: var(--sp-2) var(--sp-4); border-radius: var(--radius-md); border: none; background: transparent; color: var(--muted); cursor: pointer; position: relative; }
  .tabs button:hover { color: var(--ink); background: var(--bg); }
  .tabs button.active { background: var(--brand); color: var(--brand-ink); font-weight: 600; }
  .tabs button:focus-visible { outline: 2px solid var(--tl-dot-ring); outline-offset: 2px; }
  .tabs .badge { position: absolute; top: -8px; right: -8px; background: var(--warn); color: #fff; border-radius: 10px; font-size: 11px; padding: 0 6px; }

  /* ---- primitives ---- */
  .card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: var(--sp-4); margin-bottom: var(--sp-4); box-shadow: var(--shadow-1); }
  .row { display: flex; gap: var(--sp-3); align-items: center; flex-wrap: wrap; }
  label { font-size: 13px; color: var(--muted); }
  input[type=text], input[type=password], textarea, select { font: inherit; padding: var(--sp-2) 10px; border: 1px solid var(--line-strong); border-radius: var(--radius-md); background: #fff; color: var(--ink); }
  input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid var(--tl-dot-ring); outline-offset: 1px; }
  textarea { width: 100%; min-height: 84px; resize: vertical; }
  .btn { font: inherit; padding: var(--sp-2) var(--sp-4); border-radius: var(--radius-md); border: 1px solid var(--brand); background: var(--brand); color: var(--brand-ink); cursor: pointer; }
  .btn:hover { filter: brightness(1.06); }
  .btn.secondary { background: #fff; color: var(--brand); }
  .btn.danger { background: #fff; color: var(--err); border-color: var(--err); }
  .btn:disabled { opacity: .5; cursor: default; }
  .btn:focus-visible { outline: 2px solid var(--tl-dot-ring); outline-offset: 2px; }

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
  .chip.action-type { color: var(--muted); background: var(--idle-bg); font-family: var(--font-mono); font-weight: 500; }

  .kv { display: grid; grid-template-columns: max-content 1fr; gap: 2px 14px; font-size: 13px; }
  .kv dt { color: var(--muted); } .kv dd { margin: 0; word-break: break-all; }

  /* ---- audit timeline ---- */
  .timeline { position: relative; margin: var(--sp-3) 0 var(--sp-1) 7px; border-left: 2px solid var(--tl-line); display: flex; flex-direction: column; gap: var(--sp-2); }
  .node { position: relative; }
  .node::before { content: ""; position: absolute; left: -14px; top: 10px; width: 10px; height: 10px; border-radius: 50%; background: var(--tl-dot); border: 2px solid var(--tl-dot-ring); }
  .node.n-err::before { border-color: var(--err); }
  .node.n-warn::before { border-color: var(--warn); }
  .node.n-ok::before { border-color: var(--ok); }
  .node-head { display: flex; gap: var(--sp-2); align-items: center; flex-wrap: wrap; width: 100%; text-align: left; font: inherit; background: transparent; border: none; padding: var(--sp-1) 0; cursor: pointer; color: var(--ink); border-radius: var(--radius-sm); }
  .node-head:hover { color: var(--brand); }
  .node-head:focus-visible { outline: 2px solid var(--tl-dot-ring); outline-offset: 2px; }
  .node-head .caret { color: var(--muted); font-size: 11px; width: 12px; }
  .node.collapsed .caret { transform: rotate(-90deg); }
  .node-body { border-left: 3px solid var(--line); padding: var(--sp-2) var(--sp-3); margin: var(--sp-1) 0 var(--sp-1) 2px; background: #fafbfc; border-radius: 0 var(--radius-md) var(--radius-md) 0; }
  .node.collapsed .node-body { display: none; }
  .node-body .m { color: var(--muted); font-size: 12px; }
  .node-body .pair { margin: var(--sp-1) 0; }
  .node-body .pair .m { display: block; }

  pre.json { background: var(--json-bg); color: var(--json-ink); padding: var(--sp-3); border-radius: var(--radius-md); overflow: auto; font-size: 12px; font-family: var(--font-mono); max-height: 280px; margin: var(--sp-1) 0; }
  .hl-key { color: var(--hl-key); } .hl-str { color: var(--hl-str); }
  .hl-num { color: var(--hl-num); } .hl-bool { color: var(--hl-bool); } .hl-null { color: var(--hl-null); }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 600; }
  tr.click { cursor: pointer; } tr.click:hover { background: #f7f9fd; }

  .approval { border: 1px solid var(--line); border-left: 4px solid var(--warn); border-radius: var(--radius-md); padding: var(--sp-4); margin-bottom: var(--sp-3); background: var(--card); box-shadow: var(--shadow-1); transition: opacity .4s ease; }
  .approval .title { font-weight: 600; display: flex; gap: var(--sp-2); align-items: center; flex-wrap: wrap; }
  .approval .desc { color: var(--muted); margin: var(--sp-1) 0; }
  .approval.resolved { opacity: 0; }

  .empty { color: var(--muted); padding: var(--sp-5) 0; text-align: center; }
  .error { color: var(--err); font-size: 13px; margin-top: var(--sp-2); white-space: pre-wrap; }
  .hint { background: var(--run-bg); color: var(--run); border-radius: var(--radius-md); padding: var(--sp-2) var(--sp-3); font-size: 13px; margin-bottom: var(--sp-3); border: 1px solid #cddcfd; }
  .muted { color: var(--muted); } .mono { font-family: var(--font-mono); font-size: 12px; }
  section h3 { margin: var(--sp-4) 0 var(--sp-2); font-size: 14px; }
  .hidden { display: none !important; }

  @media (max-width: 720px) {
    header { flex-wrap: wrap; padding: var(--sp-2) var(--sp-3); }
    main { margin: var(--sp-3) auto; }
    .tabs { overflow-x: auto; }
    .kv { grid-template-columns: 1fr; }
  }
`;
