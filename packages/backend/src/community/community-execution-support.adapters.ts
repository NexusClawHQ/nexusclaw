import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  ExecutionApprovalPort,
  ExecutionApprovalRequest,
  ExecutionConstitutionPort,
  PostExecutionMemoryPort,
} from '../modules/agent-runtime/contracts/runtime-boundary-ports';
import type { AgentExecutionContext } from '../modules/agent-runtime/interfaces';
import { ApprovalInstance } from '../modules/approval/entities/approval-instance.entity';
import { AuditLoggerService } from '../modules/guardrail/services/audit-logger.service';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const COMMUNITY_AGENT_APPROVAL_PROCESS_ID =
  '00000000-0000-0000-0000-000000000001';

@Injectable()
export class CommunityExecutionApprovalAdapter implements ExecutionApprovalPort {
  constructor(
    @InjectRepository(ApprovalInstance)
    private readonly approvals: Repository<ApprovalInstance>,
    private readonly events: EventEmitter2,
    private readonly audit: AuditLoggerService,
  ) {}

  async createAgentApproval(request: ExecutionApprovalRequest): Promise<{ id: string }> {
    if (request.approvalPreparation) {
      throw new Error('COMMUNITY_GOVERNED_APPROVAL_POLICY_UNAVAILABLE');
    }
    const pausedToolCall = JSON.stringify({
      toolName: request.toolName,
      toolInput: request.toolInput,
      riskLevel: request.riskLevel,
      description: request.description,
    });
    const saved = await this.approvals.save(
      this.approvals.create({
        workspaceId: request.workspaceId,
        processId: COMMUNITY_AGENT_APPROVAL_PROCESS_ID,
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
          actorName: 'Community Agent Runtime',
          comments: `Tool: ${request.toolName}, Risk: ${request.riskLevel} — ${request.description}\n__pausedToolCall__:${pausedToolCall}`,
          timestamp: new Date().toISOString(),
        }],
      }),
    );
    const approval = Array.isArray(saved) ? saved[0] : saved;
    this.events.emit('approval.created', {
      workspaceId: request.workspaceId,
      instanceId: approval.id,
      agentExecutionId: request.agentExecutionId,
      toolName: request.toolName,
      riskLevel: request.riskLevel,
    });
    await this.audit.logGuardrailEvent({
      workspaceId: request.workspaceId,
      executionId: request.agentExecutionId,
      ruleName: 'Community Approval Degradation Gate',
      riskLevel: request.riskLevel,
      operationType: request.toolName,
      actionTaken: 'approve',
      approvalStatus: 'pending',
      approvalId: approval.id,
      context: {
        traceId: request.traceId,
        correlationId: request.correlationId ?? request.traceId,
        actorType: request.actorType,
        actorId: request.actorId,
        source: request.source,
      },
    });
    return { id: approval.id };
  }
}

@Injectable()
export class CommunityExecutionConstitutionAdapter
  implements ExecutionConstitutionPort
{
  async getActiveText(): Promise<null> {
    return null;
  }
}

@Injectable()
export class CommunityPostExecutionMemoryAdapter
  implements PostExecutionMemoryPort
{
  async distillAfterExecution(
    _execution: { id: string; workspaceId: string },
    _context: AgentExecutionContext,
    _summary: string,
  ): Promise<void> {}
}
