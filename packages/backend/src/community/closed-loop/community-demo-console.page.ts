/**
 * The Community demo console — a single static page, no build toolchain and
 * no host filesystem reads. Served at GET /console.
 *
 * Assembled from three literal parts (styles / body / script) so the file
 * stays reviewable as it grows. The assembled output is what ships; every
 * part keeps the console invariants:
 *   - every branch/status key is a stable code; display strings come only
 *     from the COPY map via t() (no display string is ever a state key);
 *   - untrusted data is rendered via textContent/createElement only.
 */
import { COMMUNITY_DEMO_CONSOLE_STYLES } from './community-demo-console.styles';
import { COMMUNITY_DEMO_CONSOLE_BODY } from './community-demo-console.body';
import { COMMUNITY_DEMO_CONSOLE_SCRIPT } from './community-demo-console.script';

export const COMMUNITY_DEMO_CONSOLE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NexusClaw Community Console</title>
<style>
${COMMUNITY_DEMO_CONSOLE_STYLES}</style>
</head>
<body>
${COMMUNITY_DEMO_CONSOLE_BODY}<script>
${COMMUNITY_DEMO_CONSOLE_SCRIPT}</script>
</body>
</html>
`;
