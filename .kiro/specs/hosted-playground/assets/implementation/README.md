# Implementation screenshots (T4)

Live captures of the shipped playground at `http://localhost:3002/playground`
(2026-08-18, deterministic scenario, real browser via CDP):

- `playground-landing.png` — hero + the single run button + three-step intro.
- `playground-paused.png` — the L3 human gate: L1 lookup proceeded (green),
  `demo.send_followup_email` paused with the visitor's 批准/拒绝 buttons.
- `playground-complete.png` — after visitor approval: resumed run, done state,
  audit-chain card (tool records with permission/guardrail chips).

Historical note: the earlier "T4 待真实浏览器补拍" was not a headless-timing
issue — capturing these revealed a real regression (the page polled
`toolCallRecords { riskLevel }`, a field the schema never exposed, so every
poll failed silently and the timeline never rendered). Fixed the same day
with a query-selection guard test
(`community-playground.query-guard.spec.ts`).
