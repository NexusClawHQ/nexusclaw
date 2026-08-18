import type { GuardrailRule } from '@agent-governance/guardrail';
import { DEMO_WORKSPACE_ID } from '../runtime.js';
import { createMcpGateway, PENDING_LOOKUP_TOOL } from './gateway.js';
import { buildMemoryDemoUpstream } from './memory-upstream.js';
import { httpUpstream, parseUpstreamEnv, type Upstream } from './upstream.js';

export interface McpBootstrap {
  enabled: boolean;
  upstreams: Upstream[];
  extraGuardrailRules: GuardrailRule[];
  extraAllowedTools: string[];
  exposeDeniedTools: boolean;
}

/**
 * Resolve the MCP gateway configuration from the environment, shared by the
 * dev server and the zero-config bin:
 *   SIDECAR_MCP_DEMO=memory                     in-process demo upstream
 *   SIDECAR_MCP_UPSTREAMS=name|url[|token],…     real Streamable-HTTP upstreams
 *   SIDECAR_MCP_EXPOSE_DENIED=true               surface ungranted tools
 */
export async function bootstrapMcpFromEnv(): Promise<McpBootstrap> {
  const demo = process.env.SIDECAR_MCP_DEMO === 'memory';
  const upstreamsEnv = parseUpstreamEnv(process.env.SIDECAR_MCP_UPSTREAMS);
  const enabled = demo || upstreamsEnv.length > 0;

  const upstreams: Upstream[] = [];
  const extraGuardrailRules: GuardrailRule[] = [];
  const extraAllowedTools: string[] = [];
  if (!enabled) {
    return { enabled: false, upstreams, extraGuardrailRules, extraAllowedTools, exposeDeniedTools: false };
  }

  if (demo) {
    upstreams.push(await buildMemoryDemoUpstream());
    extraAllowedTools.push('memory__echo', 'memory__counter', 'memory__send_notice');
    extraGuardrailRules.push({
      id: '30000000-0000-4000-8000-000000000003',
      workspaceId: DEMO_WORKSPACE_ID,
      name: 'MCP demo send_notice — requires human approval',
      description: 'L3: outbound notices pause for a human decision.',
      riskLevel: 'L3',
      priority: 3,
      isActive: true,
      conditions: { operation: 'memory__send_notice' },
    } as GuardrailRule);
  }
  for (const { name, url, token } of upstreamsEnv) {
    upstreams.push(await httpUpstream(name, url, token));
  }
  extraAllowedTools.push(PENDING_LOOKUP_TOOL);

  return {
    enabled: true,
    upstreams,
    extraGuardrailRules,
    extraAllowedTools,
    exposeDeniedTools: process.env.SIDECAR_MCP_EXPOSE_DENIED === 'true',
  };
}

/** Attach the gateway for an already-resolved bootstrap. Callers must have
 *  included `bootstrap.extraAllowedTools`/`extraGuardrailRules` when building
 *  the runtime — the gate's grant list is baked in at construction. */
export async function attachMcpGateway(
  app: import('express').Express,
  runtime: import('../runtime.js').SidecarRuntime,
  bootstrap: McpBootstrap,
  gateAllowedTools: string[],
): Promise<void> {
  if (!bootstrap.enabled) return;
  const gateway = await createMcpGateway({
    runtime,
    upstreams: bootstrap.upstreams,
    allowedTools: gateAllowedTools,
    exposeDeniedTools: bootstrap.exposeDeniedTools,
  });
  gateway.attach(app);
}
