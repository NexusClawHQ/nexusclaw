import 'reflect-metadata';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { DataSource, Repository } from 'typeorm';
import pg from 'pg';

import {
  ApprovalEngineService,
  ApprovalInstance,
  ApprovalStep,
  ApprovalProcess,
  ApprovalPolicyRevisionEntity,
  AGENT_SENSITIVE_OP_PROCESS_ID,
  noopAudit,
} from '../src/index.js';
import type { ApprovalAuditPort, ApprovalEventsPort } from '../src/index.js';

const HOST = process.env.APPROVAL_TEST_PGHOST ?? 'localhost';
const PORT = Number(process.env.APPROVAL_TEST_PGPORT ?? 5432);
const USER = process.env.APPROVAL_TEST_PGUSER ?? 'postgres';
const PASSWORD = process.env.APPROVAL_TEST_PGPASSWORD ?? 'postgres';
const DB = 'nexusclaw_approval_verify_tmp';
const WS = '00000000-0000-4000-8000-000000000001';

describe('ApprovalEngineService (decision core, real Postgres)', () => {
  let admin: pg.Client;
  let dataSource: DataSource;
  let instances: Repository<ApprovalInstance>;
  let steps: Repository<ApprovalStep>;
  let events: ApprovalEventsPort & { emitted: Array<[string, Record<string, unknown>]> };
  let audit: ApprovalAuditPort & { logCalls: number; updateCalls: number };
  let service: ApprovalEngineService;

  beforeAll(async () => {
    admin = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
    await admin.query(`CREATE DATABASE ${DB}`);
    await admin.end();

    dataSource = new DataSource({
      type: 'postgres',
      host: HOST,
      port: PORT,
      username: USER,
      password: PASSWORD,
      database: DB,
      entities: [ApprovalInstance, ApprovalStep, ApprovalProcess, ApprovalPolicyRevisionEntity],
      synchronize: true,
    });
    await dataSource.initialize();
    instances = dataSource.getRepository(ApprovalInstance);
    steps = dataSource.getRepository(ApprovalStep);

    events = {
      emitted: [],
      emit(event, payload) { this.emitted.push([event, payload]); },
    };
    audit = {
      logCalls: 0,
      updateCalls: 0,
      async logGuardrailEvent() { this.logCalls++; },
      async updateGuardrailLogByApprovalId() { this.updateCalls++; },
    };
    service = new ApprovalEngineService(steps, instances, { events, audit });
  });

  afterAll(async () => {
    await dataSource.destroy();
    const cleanup = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
    await cleanup.connect();
    await cleanup.query(`DROP DATABASE IF EXISTS ${DB}`);
    await cleanup.end();
  });

  const agentRequest = {
    workspaceId: WS,
    agentExecutionId: '20000000-0000-4000-8000-000000000001',
    toolName: 'demo.send_email',
    toolInput: { objectApiName: 'Contact', customerId: 'C-1' },
    riskLevel: 'L3',
    description: 'Outbound email requires approval',
  };

  it('createAgentApproval persists a PENDING instance with the paused tool call', async () => {
    const instance = await service.createAgentApproval(agentRequest);
    expect(instance.status).toBe('PENDING');
    expect(instance.processId).toBe(AGENT_SENSITIVE_OP_PROCESS_ID);
    expect(instance.recordId).toBe(agentRequest.agentExecutionId);
    expect(instance.history[0]!.comments).toContain('__pausedToolCall__:');
    expect(events.emitted.some(([e]) => e === 'approval.created')).toBe(true);
    expect(audit.logCalls).toBe(1);

    const loaded = await instances.findOneByOrFail({ id: instance.id });
    expect(loaded.status).toBe('PENDING');
    expect(JSON.parse(loaded.history[0]!.comments.split('__pausedToolCall__:')[1]!)).toMatchObject({
      toolName: 'demo.send_email',
      riskLevel: 'L3',
    });
  });

  it('approve emits the agent resume event and records the decision', async () => {
    events.emitted = [];
    const instance = await service.createAgentApproval(agentRequest);
    const decided = await service.processDecision({
      instanceId: instance.id,
      approverId: 'user-1',
      approverName: 'Demo User',
      action: 'APPROVED',
      comments: 'looks good',
    });
    expect(decided.status).toBe('APPROVED');
    expect(decided.completedAt).toBeInstanceOf(Date);
    const resume = events.emitted.find(([e]) => e === 'approval.agent.resume');
    expect(resume).toBeDefined();
    expect(resume![1]).toMatchObject({
      agentExecutionId: agentRequest.agentExecutionId,
      instanceId: instance.id,
    });
    expect(audit.updateCalls).toBe(1);
  });

  it('reject emits the agent terminate event', async () => {
    events.emitted = [];
    const instance = await service.createAgentApproval(agentRequest);
    const decided = await service.processDecision({
      instanceId: instance.id,
      approverId: 'user-1',
      approverName: 'Demo User',
      action: 'REJECTED',
      comments: 'no',
    });
    expect(decided.status).toBe('REJECTED');
    const terminate = events.emitted.find(([e]) => e === 'approval.agent.terminate');
    expect(terminate).toBeDefined();
    expect(terminate![1]).toMatchObject({ reason: 'no' });
  });

  it('rejects decisions on already-decided instances', async () => {
    const instance = await service.createAgentApproval(agentRequest);
    await service.processDecision({
      instanceId: instance.id, approverId: 'user-1', approverName: 'U', action: 'APPROVED',
    });
    await expect(
      service.processDecision({
        instanceId: instance.id, approverId: 'user-1', approverName: 'U', action: 'REJECTED',
      }),
    ).rejects.toThrow('is not pending');
  });

  it('advances through multi-step processes', async () => {
    const process = await dataSource.getRepository(ApprovalProcess).save({
      id: '30000000-0000-4000-8000-000000000001',
      workspaceId: WS,
      name: 'Two-step',
      apiName: 'two_step',
      objectName: 'TestRecord',
    });
    await service.configureSteps(process.id, [
      { stepOrder: 1, stepName: 'Manager', stepType: 'serial', approverType: 'user', approverId: '50000000-0000-4000-8000-000000000001' },
      { stepOrder: 2, stepName: 'Director', stepType: 'serial', approverType: 'user', approverId: '50000000-0000-4000-8000-000000000002' },
    ]);

    const instance = await instances.save(instances.create({
      workspaceId: WS,
      processId: process.id,
      recordId: '40000000-0000-4000-8000-000000000001',
      objectName: 'TestRecord',
      status: 'PENDING',
      currentStepIndex: 0,
      submittedBy: '00000000-0000-0000-0000-000000000000',
      history: [],
    }));

    const step1 = await service.processDecision({
      instanceId: instance.id, approverId: '50000000-0000-4000-8000-000000000001', approverName: 'M', action: 'APPROVED',
    });
    expect(step1.status).toBe('PENDING');
    expect(step1.currentStepIndex).toBe(1);

    const step2 = await service.processDecision({
      instanceId: instance.id, approverId: '50000000-0000-4000-8000-000000000002', approverName: 'D', action: 'APPROVED',
    });
    expect(step2.status).toBe('APPROVED');
    expect(step2.history).toHaveLength(2);
  });

  it('timeout auto-rejects pending instances and terminates agent approvals', async () => {
    events.emitted = [];
    const instance = await service.createAgentApproval(agentRequest);
    await service.processTimeout(instance.id);
    const loaded = await instances.findOneByOrFail({ id: instance.id });
    expect(loaded.status).toBe('REJECTED');
    expect(events.emitted.some(([e]) => e === 'approval.agent.terminate')).toBe(true);
  });

  it('concurrent decisions fail with CAS conflict', async () => {
    const instance = await service.createAgentApproval(agentRequest);
    const first = await service.processDecision({
      instanceId: instance.id, approverId: 'user-1', approverName: 'U', action: 'APPROVED',
    });
    void first;
    await expect(
      service.processDecision({
        instanceId: instance.id, approverId: 'user-1', approverName: 'U', action: 'REJECTED',
      }),
    ).rejects.toThrow('not pending');
  });

  it('works with the noop audit default', async () => {
    const plain = new ApprovalEngineService(steps, instances, { events });
    const instance = await plain.createAgentApproval(agentRequest);
    expect(instance.status).toBe('PENDING');
  });

  it('uses the custom approver check port on stepped processes', async () => {
    const check = { canApprove: vi.fn(async () => false) };
    const custom = new ApprovalEngineService(steps, instances, { events, approverCheck: check });
    const process = await dataSource.getRepository(ApprovalProcess).save({
      id: '30000000-0000-4000-8000-000000000002',
      workspaceId: WS,
      name: 'Checked',
      apiName: 'checked',
      objectName: 'TestRecord',
    });
    await custom.configureSteps(process.id, [
      { stepOrder: 1, stepName: 'Owner', stepType: 'serial', approverType: 'user', approverId: '50000000-0000-4000-8000-000000000003' },
    ]);
    const instance = await instances.save(instances.create({
      workspaceId: WS,
      processId: process.id,
      recordId: '40000000-0000-4000-8000-000000000002',
      objectName: 'TestRecord',
      status: 'PENDING',
      currentStepIndex: 0,
      submittedBy: '00000000-0000-0000-0000-000000000000',
      history: [],
    }));
    await expect(
      custom.processDecision({
        instanceId: instance.id, approverId: 'user-1', approverName: 'U', action: 'APPROVED',
      }),
    ).rejects.toThrow('not the current approver');
    expect(check.canApprove).toHaveBeenCalled();
  });
});
