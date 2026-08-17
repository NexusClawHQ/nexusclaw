/**
 * Pure allow-list resolution for agent tool grants.
 *
 * Extracted from nexusclaw-core agent-runtime/context-builder
 * `getAllowedTools` with the hardcoded CRM default REMOVED: the product
 * silently fell back to 6 built-in CRM tools (record.query / record.create /
 * record.update / email.draft / report.generate / knowledge.search) whenever
 * an agent had no explicit grants — and even on config-load errors. A
 * standalone governance library must not invent grants, so `defaultTools`
 * defaults to `[]` (true deny-by-default); product owners can pass their own
 * defaults explicitly if they want the legacy behavior.
 */

export interface AllowListSources {
  /** Highest priority: agent permission extension (e.g. per-agent config). */
  extensionAllowedTools?: string[] | null;
  /** Next: agent guardrail rules. */
  guardrailAllowedTools?: string[] | null;
  /** Applies last: never overridable by defaults. */
  blockedTools?: string[] | null;
  /**
   * Legacy product fallback. DEFAULT EMPTY — a standalone library grants
   * nothing implicitly.
   */
  defaultTools?: string[];
}

export function resolveAllowedTools(sources: AllowListSources): string[] {
  const { extensionAllowedTools, guardrailAllowedTools, blockedTools, defaultTools } = sources;
  const allowed =
    extensionAllowedTools && extensionAllowedTools.length > 0
      ? extensionAllowedTools
      : guardrailAllowedTools && guardrailAllowedTools.length > 0
        ? guardrailAllowedTools
        : (defaultTools ?? []);

  if (blockedTools && blockedTools.length > 0) {
    const blockedSet = new Set(blockedTools);
    return allowed.filter((tool) => !blockedSet.has(tool));
  }
  return [...allowed];
}
