import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ToolRegistryService } from '../../modules/agent-runtime/tool-framework/tool-registry.service';
import type {
  AgentExecutionContext,
  AgentTool,
  AgentToolProvider,
  ToolCallResult,
} from '../../modules/agent-runtime/interfaces';
import {
  COMMUNITY_DEMO_CUSTOMER_ID,
  COMMUNITY_DEMO_LOOKUP_RESULT_MARKER,
  COMMUNITY_DEMO_SEND_RESULT_MARKER,
  COMMUNITY_DEMO_TOOL_LOOKUP,
  COMMUNITY_DEMO_TOOL_SEND_EMAIL,
} from './community-demo.constants';

const ok = (
  output: Record<string, unknown>,
  startedAt: number,
): ToolCallResult => ({
  success: true,
  output,
  permissionCheck: 'passed',
  guardrailCheck: 'passed',
  duration: Date.now() - startedAt,
});

/**
 * Deterministic demo toolset for the Community closed loop.
 *
 * Both tools are pure local stubs — no external system is ever contacted.
 * They exist so a fresh self-hosted instance can demonstrate the full
 * governance chain (deny-by-default allowlist → permission gate → L1 audit
 * → L3 approval pause/resume → tool_call_records) with zero configuration.
 */
@Injectable()
export class CommunityDemoToolsetProvider
  implements AgentToolProvider, OnModuleInit
{
  readonly providerKey = 'community-demo';

  private readonly logger = new Logger(CommunityDemoToolsetProvider.name);

  constructor(private readonly registry: ToolRegistryService) {}

  onModuleInit(): void {
    this.registry.registerProvider(this);
    this.logger.log('Community demo toolset registered');
  }

  buildTools(): AgentTool[] {
    return [this.buildLookupTool(), this.buildSendEmailTool()];
  }

  /** L1 — read-only customer lookup, audited and allowed to proceed. */
  private buildLookupTool(): AgentTool {
    return {
      name: COMMUNITY_DEMO_TOOL_LOOKUP,
      description:
        'Look up a demo customer profile by customer ID (deterministic local stub, read-only).',
      category: 'crm',
      riskLevel: 'L1',
      inputSchema: {
        type: 'object',
        required: ['customerId'],
        properties: {
          customerId: { type: 'string' },
          objectApiName: { type: 'string' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          name: { type: 'string' },
        },
      },
      requiredPermissions: { objectApiName: 'Contact', operation: 'read' },
      execute: async (
        input: unknown,
        _context: AgentExecutionContext,
      ): Promise<ToolCallResult> => {
        const startedAt = Date.now();
        const customerId =
          (input as { customerId?: string } | null)?.customerId ??
          COMMUNITY_DEMO_CUSTOMER_ID;
        return ok(
          {
            customerId,
            name: 'Acme Robotics',
            tier: 'A',
            ownerName: 'Dana Chen',
            lastInteractionDays: 6,
            openOpportunities: 2,
            note: COMMUNITY_DEMO_LOOKUP_RESULT_MARKER + ' — local deterministic stub',
          },
          startedAt,
        );
      },
    };
  }

  /** L3 — outbound follow-up email, requires human approval before running. */
  private buildSendEmailTool(): AgentTool {
    return {
      name: COMMUNITY_DEMO_TOOL_SEND_EMAIL,
      description:
        'Draft and send a follow-up email to a customer (deterministic local stub — nothing is actually delivered).',
      category: 'external',
      riskLevel: 'L3',
      inputSchema: {
        type: 'object',
        required: ['customerId', 'subject', 'body'],
        properties: {
          customerId: { type: 'string' },
          objectApiName: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          accepted: { type: 'boolean' },
          channel: { type: 'string' },
        },
      },
      requiredPermissions: { objectApiName: 'Contact', operation: 'update' },
      execute: async (
        input: unknown,
        _context: AgentExecutionContext,
      ): Promise<ToolCallResult> => {
        const startedAt = Date.now();
        const payload = (input ?? {}) as {
          customerId?: string;
          subject?: string;
        };
        return ok(
          {
            accepted: true,
            channel: COMMUNITY_DEMO_SEND_RESULT_MARKER,
            customerId: payload.customerId ?? COMMUNITY_DEMO_CUSTOMER_ID,
            subject: payload.subject ?? '',
            note: 'demo send result — dry run only, no external message was delivered',
          },
          startedAt,
        );
      },
    };
  }
}
