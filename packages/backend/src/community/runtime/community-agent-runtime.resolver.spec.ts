import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

// The resolver imports decorated TypeORM entities; the vitest 4 + vite 8
// (rolldown/oxc) transform pipeline does not emit decorator metadata for
// bare @Column() types, so the entity modules are stubbed out here. The
// mutation under test touches only the agents repository and the outbox.
vi.mock('../../modules/agent/entities/agent.entity', () => ({
  Agent: class Agent {},
}));
vi.mock('../../modules/agent-runtime/entities/agent-execution.entity', () => ({
  AgentExecution: class AgentExecution {},
}));
vi.mock('../../modules/approval/entities/approval-instance.entity', () => ({
  ApprovalInstance: class ApprovalInstance {},
  ApprovalHistoryEntry: class ApprovalHistoryEntry {},
}));
vi.mock('../../modules/outbox/entities/outbox-event.entity', () => ({
  OutboxEvent: class OutboxEvent {},
}));
vi.mock('../../modules/agent-runtime/executor/executor-engine.service', () => ({
  ExecutorEngineService: class ExecutorEngineService {},
}));
vi.mock('../../modules/outbox/services/outbox.service', () => ({
  OutboxService: class OutboxService {},
}));
vi.mock('../byo/community-model-source.service', () => ({
  CommunityModelSourceService: class CommunityModelSourceService {},
}));
vi.mock('./community-agent-insights.service', () => ({
  CommunityAgentInsightsService: class CommunityAgentInsightsService {},
}));
vi.mock('../playground/community-playground.registry', () => ({
  PlaygroundSessionRegistry: class PlaygroundSessionRegistry {},
}));

import { CommunityAgentRuntimeResolver } from './community-agent-runtime.resolver';
import {
  CommunityCreateAgentInput,
  CommunityUpdateAgentConfigInput,
} from './community-console.dto';
import type { Agent } from '../../modules/agent/entities/agent.entity';

const PRINCIPAL = {
  id: 'u1',
  roleId: 'r1',
  defaultWorkspaceId: 'ws-1',
} as never;

function makeResolver(agentRow: Partial<Agent> | null) {
  const agentsRepo = {
    findOne: vi.fn(async () => agentRow),
    update: vi.fn(async () => ({ affected: 1 })),
    create: vi.fn((row: Partial<Agent>) => ({ ...row, id: 'new-1', createdAt: new Date() })),
    save: vi.fn(async (row: Partial<Agent>) => row),
  };
  const enqueued: unknown[] = [];
  const outbox = {
    runInTransaction: vi.fn(
      async (
        cb: (manager: unknown, ob: { enqueue: (e: unknown) => Promise<void> }) => Promise<void>,
      ) => {
        const manager = { getRepository: vi.fn(() => agentsRepo) };
        await cb(manager, {
          enqueue: async (event) => {
            enqueued.push(event);
          },
        });
      },
    ),
  };
  const resolver = new CommunityAgentRuntimeResolver(
    {} as never, // executions repo
    agentsRepo as never,
    {} as never, // approvals repo
    {} as never, // outboxEvents repo
    {} as never, // executor
    outbox as never,
    {} as never, // modelSourceService
    {} as never, // insights
    {} as never, // playgroundRegistry
  );
  return { resolver, agentsRepo, enqueued };
}

const input = (partial: Partial<CommunityUpdateAgentConfigInput>) =>
  Object.assign(new CommunityUpdateAgentConfigInput(), partial);

describe('communityUpdateAgentConfig', () => {
  it('rejects an agent outside the caller workspace', async () => {
    const { resolver } = makeResolver(null);
    await expect(
      resolver.updateAgentConfig(
        'a1',
        input({ prompt: 'hello' }),
        PRINCIPAL,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a malformed sensitiveOps riskLevel without writing', async () => {
    const { resolver, agentsRepo } = makeResolver({
      id: 'a1',
      workspaceId: 'ws-1',
      version: 1,
      guardrailRules: {},
    });
    await expect(
      resolver.updateAgentConfig(
        'a1',
        input({
          sensitiveOps: [
            {
              operation: 'send_followup_email',
              toolPattern: 'demo.send_followup_email',
              riskLevel: 'L9',
              action: 'approve',
            },
          ],
        }),
        PRINCIPAL,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(agentsRepo.update).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range execution constraint', async () => {
    const { resolver } = makeResolver({
      id: 'a1',
      workspaceId: 'ws-1',
      version: 1,
      guardrailRules: {},
    });
    await expect(
      resolver.updateAgentConfig(
        'a1',
        input({ execution: { maxReActIterations: 99 } }),
        PRINCIPAL,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a non-string allowedTools entry', async () => {
    const { resolver } = makeResolver({
      id: 'a1',
      workspaceId: 'ws-1',
      version: 1,
      guardrailRules: {},
    });
    await expect(
      resolver.updateAgentConfig(
        'a1',
        input({ allowedTools: ['demo.customer_lookup', 42 as never] }),
        PRINCIPAL,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('applies a valid update: version+1, merged guardrailRules, audit event', async () => {
    const agentRow = {
      id: 'a1',
      workspaceId: 'ws-1',
      version: 3,
      guardrailRules: {
        allowedTools: ['demo.customer_lookup'],
      },
    };
    const { resolver, agentsRepo, enqueued } = makeResolver(agentRow);
    // First findOne reads the agent; the second returns the refreshed row.
    agentsRepo.findOne
      .mockResolvedValueOnce(agentRow)
      .mockResolvedValueOnce({
        id: 'a1',
        workspaceId: 'ws-1',
        version: 4,
        updatedAt: new Date('2026-08-18T10:00:00Z'),
      });

    const result = await resolver.updateAgentConfig(
      'a1',
      input({
        prompt: 'Be conservative.',
        allowedTools: ['demo.customer_lookup', 'demo.send_followup_email'],
        execution: { maxReActIterations: 8, timeoutMs: 90_000 },
      }),
      PRINCIPAL,
    );

    expect(result.version).toBe(4);
    const written = agentsRepo.update.mock.calls[0] as [string, Partial<Agent>];
    expect(written[1].version).toBe(4);
    const rules = written[1].guardrailRules as Record<string, any>;
    expect(rules.allowedTools).toEqual([
      'demo.customer_lookup',
      'demo.send_followup_email',
    ]);
    expect(rules.execution).toEqual({ maxReActIterations: 8, timeoutMs: 90_000 });
    expect(written[1].prompt).toBe('Be conservative.');

    expect(enqueued).toHaveLength(1);
    const event = enqueued[0] as Record<string, any>;
    expect(event.eventType).toBe('agent.config.updated');
    expect(event.aggregateType).toBe('Agent');
    expect(event.aggregateId).toBe('a1');
    expect(event.payload).toMatchObject({
      agentId: 'a1',
      version: 4,
      changedFields: ['prompt', 'allowedTools', 'execution'],
    });
  });

  it('keeps existing rules when updating a single field', async () => {
    const agentRow = {
      id: 'a1',
      workspaceId: 'ws-1',
      version: 1,
      guardrailRules: {
        allowedTools: ['demo.customer_lookup'],
        sensitiveOps: [
          {
            operation: 'customer_lookup',
            toolPattern: 'demo.customer_lookup',
            riskLevel: 'L1',
            action: 'audit',
          },
        ],
      },
    };
    const { resolver, agentsRepo, enqueued } = makeResolver(agentRow);
    agentsRepo.findOne
      .mockResolvedValueOnce(agentRow)
      .mockResolvedValueOnce({
        id: 'a1',
        workspaceId: 'ws-1',
        version: 2,
        updatedAt: new Date(),
      });

    await resolver.updateAgentConfig('a1', input({ prompt: 'New prompt' }), PRINCIPAL);

    const written = agentsRepo.update.mock.calls[0] as [string, Partial<Agent>];
    const rules = written[1].guardrailRules as Record<string, any>;
    expect(rules.allowedTools).toEqual(['demo.customer_lookup']);
    expect(rules.sensitiveOps).toHaveLength(1);
    expect(written[1].prompt).toBe('New prompt');
    expect(enqueued[0] as Record<string, any>).toMatchObject({
      eventType: 'agent.config.updated',
      payload: { changedFields: ['prompt'] },
    });
  });
});

const createInput = (partial: Partial<CommunityCreateAgentInput>) =>
  Object.assign(new CommunityCreateAgentInput(), {
    name: 'Support Assistant',
    apiName: 'support_assistant',
    ...partial,
  });

describe('communityCreateAgent', () => {
  it('creates an employee with the initial policy and an audit event', async () => {
    const { resolver, agentsRepo, enqueued } = makeResolver(null);

    const result = await resolver.createAgent(
      createInput({
        prompt: 'Be helpful.',
        allowedTools: ['demo.customer_lookup'],
        execution: { maxReActIterations: 6, timeoutMs: 120_000 },
      }),
      PRINCIPAL,
    );

    expect(result.id).toBe('new-1');
    expect(result.apiName).toBe('support_assistant');
    const saved = agentsRepo.save.mock.calls[0][0] as Partial<Agent>;
    expect(saved.workspaceId).toBe('ws-1');
    expect(saved.isCustom).toBe(true);
    expect(saved.status).toBe('active');
    expect(saved.version).toBe(1);
    const rules = saved.guardrailRules as Record<string, any>;
    expect(rules.allowedTools).toEqual(['demo.customer_lookup']);
    expect(rules.sensitiveOps).toEqual([]);
    expect(rules.execution).toEqual({ maxReActIterations: 6, timeoutMs: 120_000 });

    expect(enqueued).toHaveLength(1);
    const event = enqueued[0] as Record<string, any>;
    expect(event.eventType).toBe('agent.created');
    expect(event.aggregateType).toBe('Agent');
    expect(event.payload).toMatchObject({
      agentId: 'new-1',
      apiName: 'support_assistant',
    });
  });

  it('rejects an empty name and a missing apiName', async () => {
    const { resolver } = makeResolver(null);
    await expect(
      resolver.createAgent(createInput({ name: '  ' }), PRINCIPAL),
    ).rejects.toThrow(BadRequestException);
    await expect(
      resolver.createAgent(createInput({ apiName: '' }), PRINCIPAL),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a duplicate apiName in the workspace', async () => {
    const { resolver } = makeResolver({ id: 'a1', workspaceId: 'ws-1', apiName: 'support_assistant' });
    await expect(
      resolver.createAgent(createInput({}), PRINCIPAL),
    ).rejects.toThrow('AGENT_API_NAME_TAKEN');
  });

  it('rejects a malformed sensitiveOps on create', async () => {
    const { resolver, agentsRepo } = makeResolver(null);
    await expect(
      resolver.createAgent(
        createInput({
          sensitiveOps: [
            { operation: 'x', toolPattern: 'demo.x', riskLevel: 'L9', action: 'approve' },
          ],
        }),
        PRINCIPAL,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(agentsRepo.save).not.toHaveBeenCalled();
  });
});
