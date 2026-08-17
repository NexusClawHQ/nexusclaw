import { Repository } from 'typeorm';
import type { ExecutionApprovalPort } from '@agent-governance/contracts';
import type { StaticToolApprovalPreparationV1 } from '@agent-governance/contracts';
import { ApprovalStep } from './entities/approval-step.entity.js';
import {
  ApprovalInstance,
  ApprovalHistoryEntry,
  ApprovalAIMetadata,
} from './entities/approval-instance.entity.js';
import { ApprovalPolicyRevisionEntity } from './entities/approval-policy-revision.entity.js';
import {
  ApprovalAuditPort,
  ApprovalEventsPort,
  ApproverCheckPort,
  noopAudit,
  noopEvents,
  exactApproverCheck,
} from './ports.js';

/**
 * Approval Engine Service
 *
 * Handles multi-level approval execution with:
 * - Serial and countersign step modes
 * - Agent sensitive operation → auto-create approval + pause execution
 * - Approve → notify Agent to resume; Reject → terminate + record reason
 * - Timeout strategy (auto-reject or escalate)
 * - Complete audit trail per step
 */

/** Sentinel for non-UUID actors (e.g. "system") in NOT NULL UUID columns. */
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Sentinel processId marking agent sensitive-op approvals. These instances
 * have no backing ApprovalProcess row, but approval_instances.process_id is
 * UUID NOT NULL (migration 1750000000058), so a tag string like
 * 'agent-sensitive-op' fails on Postgres. Mirrors the NIL-UUID sentinel
 * precedent in ApprovalStepExecutor (workflow-step module).
 */
export const AGENT_SENSITIVE_OP_PROCESS_ID =
  '00000000-0000-0000-0000-000000000001';

export interface AgentApprovalRequest {
  workspaceId: string;
  agentExecutionId: string;
  toolName: string;
  toolInput: Record<string, any>;
  riskLevel: string;
  description: string;
  traceId?: string;
  correlationId?: string;
  actorType?: string;
  actorId?: string;
  source?: string;
  approvalPreparation?: StaticToolApprovalPreparationV1;
}

interface ApprovalDecision {
  instanceId: string;
  approverId: string;
  approverName: string;
  action: 'APPROVED' | 'REJECTED';
  comments?: string;
}

export interface ApprovalEngineOptions {
  policyRevisionRepo?: Repository<ApprovalPolicyRevisionEntity>;
  events?: ApprovalEventsPort;
  audit?: ApprovalAuditPort;
  approverCheck?: ApproverCheckPort;
}

export class ApprovalEngineService implements ExecutionApprovalPort {
  constructor(
    private readonly stepRepo: Repository<ApprovalStep>,
    private readonly instanceRepo: Repository<ApprovalInstance>,
    options: ApprovalEngineOptions = {},
  ) {
    this.policyRevisionRepo = options.policyRevisionRepo;
    this.events = options.events ?? noopEvents;
    this.audit = options.audit ?? noopAudit;
    this.approverCheck = options.approverCheck ?? exactApproverCheck;
  }

  private readonly policyRevisionRepo?: Repository<ApprovalPolicyRevisionEntity>;
  private readonly events: ApprovalEventsPort;
  private readonly audit: ApprovalAuditPort;
  private readonly approverCheck: ApproverCheckPort;

  // ─── Step Configuration ───

  /**
   * Configure approval steps for a process.
   */
  async configureSteps(
    approvalProcessId: string,
    steps: Array<{
      stepOrder: number;
      stepName?: string;
      stepType: 'serial' | 'countersign';
      approverType: 'user' | 'role' | 'org_node' | 'manager' | 'queue';
      approverId?: string;
      timeoutMinutes?: number;
      timeoutAction?: 'reject' | 'escalate';
    }>,
  ): Promise<ApprovalStep[]> {
    // Remove existing steps
    await this.stepRepo.delete({ approvalProcessId });

    // Create new steps
    const entities = steps.map(s => this.stepRepo.create({
      approvalProcessId,
      stepOrder: s.stepOrder,
      stepName: s.stepName,
      stepType: s.stepType,
      approverType: s.approverType,
      approverId: s.approverId,
      timeoutMinutes: s.timeoutMinutes,
      timeoutAction: s.timeoutAction || 'reject',
    }));

    return this.stepRepo.save(entities);
  }

  /**
   * Get steps for a process, ordered by stepOrder.
   */
  async getSteps(approvalProcessId: string): Promise<ApprovalStep[]> {
    return this.stepRepo.find({
      where: { approvalProcessId },
      order: { stepOrder: 'ASC' },
    });
  }

  // ─── Agent Sensitive Operation Approval ───

  /**
   * Create an approval request triggered by an Agent sensitive operation.
   * Pauses Agent execution and waits for human approval.
   */
  async createAgentApproval(request: AgentApprovalRequest): Promise<ApprovalInstance> {
    // Store pausedToolCall metadata in history[0].comments as JSON
    // agentExecutionId is stored in recordId
    const pausedToolCallJson = JSON.stringify({
      toolName: request.toolName,
      toolInput: request.toolInput,
      riskLevel: request.riskLevel,
      description: request.description,
      ...(request.approvalPreparation
        ? {
            toolCallId: request.approvalPreparation.toolCallId,
            inputDigest: request.approvalPreparation.inputDigest,
          }
        : {}),
    });

    let governed: Partial<ApprovalInstance> = {};
    if (request.approvalPreparation) {
      if (!this.policyRevisionRepo) {
        throw new Error('APPROVAL_POLICY_REVISION_OWNER_UNAVAILABLE');
      }
      const policy = await this.policyRevisionRepo.findOne({
        where: {
          workspaceId: request.workspaceId,
          id: request.approvalPreparation.approvalPolicyRevisionId,
          checksum: request.approvalPreparation.approvalPolicyChecksum,
        },
      });
      if (!policy || policy.purpose !== 'tool_call' || policy.humanOnly !== true) {
        throw new Error('APPROVAL_POLICY_REVISION_MISMATCH');
      }
      if (
        request.approvalPreparation.governanceContext.agentExecutionId !==
          request.agentExecutionId ||
        request.approvalPreparation.governanceContext.toolCallId !==
          request.approvalPreparation.toolCallId
      ) {
        throw new Error('APPROVAL_GOVERNANCE_CONTEXT_MISMATCH');
      }
      governed = {
        processId: policy.approvalProcessId,
        approvalPolicyRevisionId: policy.id,
        approvalPolicyChecksum: policy.checksum,
        subjectType: 'agent_tool',
        subjectId: request.approvalPreparation.toolCallId,
        toolCallId: request.approvalPreparation.toolCallId,
        governanceContext:
          request.approvalPreparation.governanceContext as unknown as Record<
            string,
            unknown
          >,
        expiresAt: new Date(
          Date.now() + policy.expiresAfterSeconds * 1000,
        ),
        stepVersion: '0',
        decisionVersion: '0',
      };
    }

    const instance = this.instanceRepo.create({
      workspaceId: request.workspaceId,
      processId: AGENT_SENSITIVE_OP_PROCESS_ID,
      recordId: request.agentExecutionId,
      objectName: 'AgentExecution',
      status: 'PENDING',
      currentStepIndex: 0,
      submittedBy: NIL_UUID,
      history: [{
        stepIndex: 0,
        stepName: 'Agent Sensitive Operation',
        action: 'SUBMITTED',
        actorId: 'system',
        actorName: 'Agent Runtime',
        comments: `Tool: ${request.toolName}, Risk: ${request.riskLevel} — ${request.description}\n__pausedToolCall__:${pausedToolCallJson}`,
        timestamp: new Date().toISOString(),
      }],
      ...governed,
    });

    const saved = await this.instanceRepo.save(instance);
    const savedEntity = Array.isArray(saved) ? saved[0] : saved;

    // Emit event for notification
    this.events.emit('approval.created', {
      workspaceId: request.workspaceId,
      instanceId: savedEntity.id,
      agentExecutionId: request.agentExecutionId,
      toolName: request.toolName,
      riskLevel: request.riskLevel,
    });

    /* log */ void(
      `Agent approval created: ${savedEntity.id} for execution ${request.agentExecutionId}`
    );

    await this.audit.logGuardrailEvent({
      workspaceId: request.workspaceId,
      executionId: request.agentExecutionId,
      ruleName: 'Approval Degradation Gate',
      riskLevel: request.riskLevel,
      operationType: request.toolName,
      objectApiName:
        typeof request.toolInput?.objectApiName === 'string'
          ? request.toolInput.objectApiName
          : undefined,
      actionTaken: 'approve',
      approvalStatus: 'pending',
      approvalId: savedEntity.id,
      context: {
        governanceCategory: 'approval_degradation',
        traceId: request.traceId,
        correlationId: request.correlationId ?? request.traceId,
        actorType: request.actorType,
        actorId: request.actorId,
        source: request.source,
        toolName: request.toolName,
        description: request.description,
      },
    });

    return savedEntity;
  }

  // ─── Approval Decision Processing ───

  /**
   * Process an approval decision (approve or reject).
   * For Agent approvals: approve → emit resume event; reject → emit terminate event.
   */
  async processDecision(decision: ApprovalDecision): Promise<ApprovalInstance> {
    const instance = await this.instanceRepo.findOne({ where: { id: decision.instanceId } });
    if (!instance) throw new Error(`Approval instance ${decision.instanceId} not found`);
    if (instance.subjectType) {
      throw new Error('APPROVAL_V2_DECISION_OWNER_REQUIRED');
    }
    if (instance.status !== 'PENDING') {
      throw new Error(`Approval instance ${decision.instanceId} is not pending`);
    }
    const expectedStepIndex = instance.currentStepIndex;
    const governedSteps = await this.resolveGovernedSteps(instance);
    const steps = governedSteps
      ? []
      : await this.getStepsForInstance(instance);
    const currentStep = steps[instance.currentStepIndex];
    const governedStep = governedSteps?.[instance.currentStepIndex];
    const queueContext =
      currentStep?.approverType === 'queue' ? currentStep.approverId : undefined;

    if (
      (governedStep &&
        !governedStep.approverIds.includes(decision.approverId)) ||
      (!governedStep &&
        currentStep &&
        !(await this.canUserApproveStep(currentStep, decision.approverId)))
    ) {
      throw new Error(`User ${decision.approverId} is not the current approver`);
    }

    // Add to audit trail
    const historyEntry: ApprovalHistoryEntry = {
      stepIndex: instance.currentStepIndex,
      stepName:
        governedStep?.name ||
        currentStep?.stepName ||
        `Step ${instance.currentStepIndex + 1}`,
      action: decision.action,
      actorId: decision.approverId,
      actorName: decision.approverName,
      comments: decision.comments,
      timestamp: new Date().toISOString(),
      queueContext,
    };
    instance.history = [...(instance.history || []), historyEntry];

    if (decision.action === 'APPROVED') {
      // Check if there are more steps (multi-level)
      const nextStepIndex = instance.currentStepIndex + 1;

      const stepCount = governedSteps?.length ?? steps.length;
      if (nextStepIndex < stepCount) {
        // Advance to next step
        instance.currentStepIndex = nextStepIndex;
        if (instance.subjectType) {
          instance.stepVersion = (
            BigInt(instance.stepVersion ?? '0') + 1n
          ).toString();
        }
        Object.assign(
          instance,
          await this.saveDecisionFirstWriter(instance, expectedStepIndex),
        );

        this.events.emit('approval.step.advanced', {
          instanceId: instance.id,
          stepIndex: nextStepIndex,
        });

        return instance;
      }

      // All steps approved — complete
      instance.status = 'APPROVED';
      instance.completedAt = new Date();
      if (instance.subjectType) {
        instance.decisionVersion = '1';
        instance.decisionActorKind = 'human';
        instance.decisionActorId = decision.approverId;
      }
      Object.assign(
        instance,
        await this.saveDecisionFirstWriter(instance, expectedStepIndex),
      );

      // If Agent approval, emit resume event
      if (this.isAgentApproval(instance)) {
        this.events.emit('approval.agent.resume', {
          workspaceId: instance.workspaceId,
          agentExecutionId: instance.recordId,
          instanceId: instance.id,
          pausedToolCall: this.extractPausedToolCall(instance),
        });
        /* log */ void(`Agent execution ${instance.recordId} approved — resuming`);
        await this.audit.updateGuardrailLogByApprovalId(instance.id, {
          approvalStatus: 'approved',
          approverId: decision.approverId,
          approvedAt: instance.completedAt,
        });
      }
    } else {
      // Rejected
      instance.status = 'REJECTED';
      instance.completedAt = new Date();
      if (instance.subjectType) {
        instance.decisionVersion = '1';
        instance.decisionActorKind = 'human';
        instance.decisionActorId = decision.approverId;
      }
      Object.assign(
        instance,
        await this.saveDecisionFirstWriter(instance, expectedStepIndex),
      );

      // If Agent approval, emit terminate event
      if (this.isAgentApproval(instance)) {
        this.events.emit('approval.agent.terminate', {
          workspaceId: instance.workspaceId,
          agentExecutionId: instance.recordId,
          instanceId: instance.id,
          reason: decision.comments || 'Approval rejected',
        });
        /* log */ void(`Agent execution ${instance.recordId} rejected — terminating`);
        await this.audit.updateGuardrailLogByApprovalId(instance.id, {
          approvalStatus: 'rejected',
          approverId: decision.approverId,
          approvedAt: instance.completedAt,
        });
      }
    }

    return instance;
  }

  // ─── Timeout Handling ───

  /**
   * Process timeout for a pending approval instance.
   * Executes the configured timeout action (reject or escalate).
   */
  async processTimeout(instanceId: string): Promise<void> {
    const instance = await this.instanceRepo.findOne({ where: { id: instanceId } });
    if (!instance || instance.status !== 'PENDING') return;

    if (instance.subjectType) {
      throw new Error('APPROVAL_V2_EXPIRY_OWNER_REQUIRED');
    }

    const steps = await this.getStepsForInstance(instance);
    const currentStep = steps[instance.currentStepIndex];
    const timeoutAction = currentStep?.timeoutAction || 'reject';

    const historyEntry: ApprovalHistoryEntry = {
      stepIndex: instance.currentStepIndex,
      stepName: currentStep?.stepName || `Step ${instance.currentStepIndex + 1}`,
      action: 'REJECTED',
      actorId: 'system',
      actorName: 'Timeout Handler',
      comments: `Auto-${timeoutAction} due to timeout (${currentStep?.timeoutMinutes || 0} minutes)`,
      timestamp: new Date().toISOString(),
    };
    instance.history = [...(instance.history || []), historyEntry];

    if (timeoutAction === 'escalate') {
      // Escalate: move to next step or reject if last step
      const nextStepIndex = instance.currentStepIndex + 1;
      if (nextStepIndex < steps.length) {
        instance.currentStepIndex = nextStepIndex;
        await this.instanceRepo.save(instance);

        this.events.emit('approval.escalated', {
          instanceId: instance.id,
          fromStep: instance.currentStepIndex - 1,
          toStep: nextStepIndex,
        });
        /* log */ void(`Approval ${instanceId} escalated to step ${nextStepIndex}`);
        return;
      }
    }

    // Auto-reject
    instance.status = 'REJECTED';
    instance.completedAt = new Date();
    await this.instanceRepo.save(instance);

    if (this.isAgentApproval(instance)) {
      await this.audit.updateGuardrailLogByApprovalId(instance.id, {
        approvalStatus: 'timeout',
        approvedAt: instance.completedAt,
      });
      this.events.emit('approval.agent.terminate', {
        workspaceId: instance.workspaceId,
        agentExecutionId: instance.recordId,
        instanceId: instance.id,
        reason: `Approval timed out (auto-${timeoutAction})`,
      });
    }

    /* log */ void(`Approval ${instanceId} auto-rejected due to timeout`);
  }

  // ─── Audit Trail ───

  /**
   * Get complete audit trail for an approval instance.
   */
  async getAuditTrail(instanceId: string): Promise<{
    instance: ApprovalInstance;
    steps: ApprovalStep[];
    history: ApprovalHistoryEntry[];
  }> {
    const instance = await this.instanceRepo.findOne({ where: { id: instanceId } });
    if (!instance) throw new Error(`Approval instance ${instanceId} not found`);

    const steps = await this.getStepsForInstance(instance);

    return {
      instance,
      steps,
      history: instance.history || [],
    };
  }


  // ─── Private helpers ───

  private async saveDecisionFirstWriter(
    instance: ApprovalInstance,
    expectedStepIndex: number,
  ): Promise<ApprovalInstance> {
    const patch: Partial<ApprovalInstance> = {
      history: instance.history,
      status: instance.status,
      currentStepIndex: instance.currentStepIndex,
      stepVersion: instance.stepVersion,
      decisionVersion: instance.decisionVersion,
      decisionActorKind: instance.decisionActorKind,
      decisionActorId: instance.decisionActorId,
    };

    if (instance.completedAt) {
      patch.completedAt = instance.completedAt;
    }

    if (typeof this.instanceRepo.update !== 'function') {
      return this.instanceRepo.save(instance);
    }

    const result = await this.instanceRepo.update(
      {
        id: instance.id,
        workspaceId: instance.workspaceId,
        status: 'PENDING',
        currentStepIndex: expectedStepIndex,
      },
      patch as Parameters<typeof this.instanceRepo.update>[1],
    );
    if (result.affected !== 1) {
      throw new Error('APPROVAL_DECISION_CONCURRENT_MODIFICATION');
    }
    return instance;
  }

  private async resolveGovernedSteps(
    instance: ApprovalInstance,
  ): Promise<Array<{ name: string; approverIds: string[] }> | null> {
    if (!instance.subjectType) return null;
    if (
      !instance.approvalPolicyRevisionId ||
      !instance.approvalPolicyChecksum ||
      !this.policyRevisionRepo
    ) {
      throw new Error('APPROVAL_GOVERNED_POLICY_UNAVAILABLE');
    }
    const revision = await this.policyRevisionRepo.findOne({
      where: {
        workspaceId: instance.workspaceId,
        id: instance.approvalPolicyRevisionId,
        checksum: instance.approvalPolicyChecksum,
      },
    });
    if (!revision || revision.purpose !== 'tool_call' || !revision.humanOnly) {
      throw new Error('APPROVAL_GOVERNED_POLICY_MISMATCH');
    }
    const snapshot = revision.stepsSnapshot as Array<{
      name: string;
      approverIds: string[];
    }> | null;
    return Array.isArray(snapshot) ? snapshot : [];
  }

  private async canUserApproveStep(
    step: ApprovalStep,
    userId: string,
  ): Promise<boolean> {
    return this.approverCheck.canApprove(step, userId);
  }

  private isAgentApproval(instance: ApprovalInstance): boolean {
    return (
      instance.processId === AGENT_SENSITIVE_OP_PROCESS_ID ||
      instance.subjectType === 'agent_tool'
    );
  }

  private extractPausedToolCall(instance: ApprovalInstance): Record<string, any> | null {
    const firstEntry = instance.history?.[0];
    if (!firstEntry?.comments) return null;
    const marker = '__pausedToolCall__:';
    const idx = firstEntry.comments.indexOf(marker);
    if (idx === -1) return null;
    try {
      return JSON.parse(firstEntry.comments.substring(idx + marker.length));
    } catch {
      return null;
    }
  }

  private async getStepsForInstance(instance: ApprovalInstance): Promise<ApprovalStep[]> {
    if (this.isAgentApproval(instance)) {
      // Agent approvals have a single implicit step
      return [];
    }
    return this.getSteps(instance.processId);
  }
}
