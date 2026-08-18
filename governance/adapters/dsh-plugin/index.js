/**
 * dsh-plugin-governance-gate — a DeepSeek Harness approval answerer backed
 * by the agent-governance sidecar (https://github.com/NexusClawHQ/nexusclaw-agent-governance).
 *
 * Every dsh `approval/request` is routed through the sidecar gate:
 *   allow              -> 'allowed-once'   (dsh executes the tool locally)
 *   blocked            -> 'rejected'       (deny-by-default; denial lands on the audit chain)
 *   paused (L2/L3)     -> waits for a human decision in the sidecar console,
 *                         then 'allowed-once' (approved) or 'rejected'
 *   sidecar unreachable/timeout -> `next()` — the waterfall stays fail-closed
 *                         (set GOVERNANCE_FAIL_CLOSED=1 to hard-reject instead)
 *
 * Env:
 *   GOVERNANCE_SIDECAR_URL   sidecar base URL (default http://127.0.0.1:7899)
 *   GOVERNANCE_POLL_MS       paused-decision poll interval (default 1000)
 *   GOVERNANCE_TIMEOUT_MS    how long to wait for the human (default 600000)
 *   GOVERNANCE_FAIL_CLOSED   '1' rejects instead of delegating on errors
 */
export const name = 'dsh-plugin-governance-gate'

const SIDECAR = process.env.GOVERNANCE_SIDECAR_URL ?? 'http://127.0.0.1:7899'
const POLL_MS = Number(process.env.GOVERNANCE_POLL_MS ?? 1000)
const TIMEOUT_MS = Number(process.env.GOVERNANCE_TIMEOUT_MS ?? 600_000)
const FAIL_CLOSED = process.env.GOVERNANCE_FAIL_CLOSED === '1'

async function callSidecar(path, init) {
  const response = await fetch(`${SIDECAR.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`sidecar ${response.status}`)
  return response.json()
}

export function apply(ctx) {
  ctx.on('approval/request', async (req, next) => {
    const toolName = req?.toolName ?? 'unknown'
    let verdict
    try {
      verdict = await callSidecar('/gate', {
        method: 'POST',
        body: JSON.stringify({
          toolName,
          // dsh's ApprovalRequest deliberately omits tool arguments (they are
          // linked via callId); input-matching risk rules therefore see the
          // call reference only.
          toolInput: { source: 'dsh', callId: req?.callId, agent: req?.agent },
        }),
      })
    } catch (error) {
      console.error(`[governance-gate] sidecar unreachable (${String(error)}); delegating`)
      return FAIL_CLOSED ? 'rejected' : next()
    }

    if (verdict.decision === 'blocked') return 'rejected'
    if (verdict.decision === 'allow') {
      await reportOutcome(verdict.executionId, `allowed by gate for dsh ${toolName}`)
      return 'allowed-once'
    }

    // paused (L2/L3): wait for the human decision in the sidecar console.
    const deadline = Date.now() + TIMEOUT_MS
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS))
      let detail
      try {
        detail = await callSidecar(`/executions/${verdict.executionId}`)
      } catch {
        continue
      }
      const status = detail?.execution?.status
      if (status === 'running' || status === 'done') {
        await reportOutcome(verdict.executionId, `approved by human for dsh ${toolName}`)
        return 'allowed-once'
      }
      if (status === 'cancelled' || status === 'failed') return 'rejected'
    }
    console.error('[governance-gate] approval wait timed out; delegating')
    return FAIL_CLOSED ? 'rejected' : next()
  })
}

async function reportOutcome(executionId, note) {
  try {
    await callSidecar(`/gate/${executionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ success: true, output: note }),
    })
  } catch {
    // The decision already claimed the request; an outcome-report failure must
    // not change it. The audit chain still holds the gate decision.
  }
}
