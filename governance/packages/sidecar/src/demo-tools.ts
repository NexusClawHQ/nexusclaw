import type { AgentTool } from '@agent-governance/contracts';
import { LOOKUP_MARKER, SEND_MARKER, TOOL_LOOKUP, TOOL_SEND } from './scenario-model.js';

/** Deterministic demo toolset — local dry-run stubs, nothing is delivered. */
export const DEMO_TOOLS: AgentTool[] = [
  {
    name: TOOL_LOOKUP,
    description: 'Look up a demo customer profile (L1, read-only, local stub).',
    category: 'crm',
    riskLevel: 'L1',
    inputSchema: { type: 'object', properties: { customerId: { type: 'string' } } },
    outputSchema: { type: 'object' },
    requiredPermissions: {},
    execute: async () => ({
      success: true,
      output: { customerId: 'C-1001', name: 'Acme Robotics', tier: 'A', note: LOOKUP_MARKER },
      permissionCheck: 'passed' as const,
      guardrailCheck: 'passed' as const,
      duration: 1,
    }),
  },
  {
    name: TOOL_SEND,
    description: 'Send a follow-up email (L3, dry run — nothing is delivered).',
    category: 'external',
    riskLevel: 'L3',
    inputSchema: { type: 'object', properties: { customerId: { type: 'string' }, subject: { type: 'string' } } },
    outputSchema: { type: 'object' },
    requiredPermissions: {},
    execute: async () => ({
      success: true,
      output: { accepted: true, channel: SEND_MARKER },
      permissionCheck: 'passed' as const,
      guardrailCheck: 'passed' as const,
      duration: 1,
    }),
  },
];
