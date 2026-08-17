/**
 * Tool access evaluation — deny by default.
 *
 * Extracted from nexusclaw-core agent-permission/tool-access.service.ts with
 * the fail-open empty-list semantics FIXED: in the product, an empty
 * allow-list meant "no whitelist restriction" because the context builder
 * always filled in 6 hardcoded CRM defaults before this check ran. In a
 * standalone library there is no such filler, so the default is inverted:
 * an empty allow-list DENIES unless `allowEmptyList: true` is explicit.
 */

export interface ToolAccessOptions {
  /** Product-compatible fail-open escape hatch. Default false (deny). */
  allowEmptyList?: boolean;
}

export class ToolAccessService {
  /**
   * - blockedTools takes priority over allowedTools.
   * - allowedTools empty: denied unless `allowEmptyList` is true.
   * - otherwise: allowed iff the tool is in allowedTools.
   */
  checkToolAccess(
    toolName: string,
    allowedTools: string[] | null | undefined,
    blockedTools: string[] | null | undefined,
    options: ToolAccessOptions = {},
  ): boolean {
    if (
      blockedTools &&
      blockedTools.length > 0 &&
      blockedTools.includes(toolName)
    ) {
      return false;
    }
    if (!allowedTools || allowedTools.length === 0) {
      return options.allowEmptyList === true;
    }
    return allowedTools.includes(toolName);
  }
}
