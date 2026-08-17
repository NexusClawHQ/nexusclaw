import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Agent } from '../../modules/agent/entities/agent.entity';
import { AgentExecution } from '../../modules/agent-runtime/entities/agent-execution.entity';
import { ReactStep } from '../../modules/agent-runtime/entities/react-step.entity';
import { ToolCallRecord } from '../../modules/agent-runtime/entities/tool-call-record.entity';
import { ExecutorEngineService } from '../../modules/agent-runtime/executor/executor-engine.service';
import { ToolRegistryService } from '../../modules/agent-runtime/tool-framework/tool-registry.service';
import { ToolCallLifecycleService } from '../../modules/agent-runtime/tool-framework/tool-call-lifecycle.service';
import {
  AUTONOMY_GATE_PORT,
  BEHAVIOR_FEEDBACK_PORT,
  EXECUTION_ADMISSION_PORT,
  EXECUTION_APPROVAL_PORT,
  EXECUTION_BUDGET_POLICY_PORT,
  EXECUTION_CONSTITUTION_PORT,
  EXECUTION_CONTEXT_PORT,
  EXECUTION_USAGE_PORT,
  EXECUTOR_MODEL_PORT,
  KNOWLEDGE_CONTEXT_PORT,
  POST_EXECUTION_MEMORY_PORT,
  RUNTIME_BEHAVIOR_EVENT_PORT,
} from '../../modules/agent-runtime/contracts/runtime-boundary-ports';
import { VERIFIED_EXEMPLAR_PORT } from '../../modules/agent-runtime/contracts/verified-exemplar.port';
import { CURATED_SCENARIO_EXEMPLAR_PORT } from '../../modules/agent-runtime/contracts/curated-scenario-exemplar.port';
import { ApprovalInstance } from '../../modules/approval/entities/approval-instance.entity';
import { GuardrailLog } from '../../modules/guardrail/entities/guardrail-log.entity';
import { AuditLoggerService } from '../../modules/guardrail/services/audit-logger.service';
import { OutboxService } from '../../modules/outbox/services/outbox.service';
import { GovernorLimitService } from '../../modules/governor-limit/governor-limit.service';
import { ObjectMetadata } from '../../modules/object-metadata/entities/object-metadata.entity';
import { ObjectPermission } from '../../modules/permission/entities/object-permission.entity';
import { CommunityAuthModule } from '../auth/community-auth.module';
import { CommunityExecutionContextAdapter } from '../community-execution-context.adapter';
import {
  CommunityExecutionApprovalAdapter,
  CommunityExecutionConstitutionAdapter,
  CommunityPostExecutionMemoryAdapter,
} from '../community-execution-support.adapters';
import {
  CommunityAutonomyGateAdapter,
  CommunityBehaviorUnavailableAdapter,
  CommunityExecutionAdmissionAdapter,
  CommunityExecutionBudgetAdapter,
  CommunityKnowledgeUnavailableAdapter,
  CommunityModelProviderAdapter,
  CommunityRagAuthorizationAdapter,
  CommunityVerifiedExemplarUnavailableAdapter,
  CommunityCuratedScenarioExemplarUnavailableAdapter,
} from '../community-runtime-adapters';
import { RAG_AUTHORIZATION_PORT } from '../../modules/agent-permission/interfaces/rag-authorization.port';
import { OutboxEvent } from '../../modules/outbox/entities/outbox-event.entity';
import { Role } from '../../modules/role/entities/role.entity';
import { User } from '../../modules/user/entities/user.entity';
import { Workspace } from '../../modules/workspace/entities/workspace.entity';
import { WorkspaceMember } from '../../modules/workspace/entities/workspace-member.entity';
import { CommunityAgentRuntimeResolver } from './community-agent-runtime.resolver';
import { CommunityDemoConsoleController } from '../closed-loop/community-demo-console.controller';
import { CommunityDemoSeedService } from '../closed-loop/community-demo-seed.service';
import { CommunityDemoToolsetProvider } from '../closed-loop/community-demo-tools';

@Module({
  imports: [
    EventEmitterModule,
    CommunityAuthModule,
    TypeOrmModule.forFeature([
      Agent,
      AgentExecution,
      ReactStep,
      ToolCallRecord,
      ApprovalInstance,
      GuardrailLog,
      ObjectPermission,
      ObjectMetadata,
      OutboxEvent,
      Workspace,
      WorkspaceMember,
      User,
      Role,
    ]),
  ],
  controllers: [CommunityDemoConsoleController],
  providers: [
    ExecutorEngineService,
    ToolRegistryService,
    ToolCallLifecycleService,
    AuditLoggerService,
    OutboxService,
    GovernorLimitService,
    CommunityAgentRuntimeResolver,
    CommunityDemoToolsetProvider,
    CommunityDemoSeedService,
    CommunityExecutionAdmissionAdapter,
    CommunityExecutionBudgetAdapter,
    CommunityBehaviorUnavailableAdapter,
    CommunityAutonomyGateAdapter,
    CommunityKnowledgeUnavailableAdapter,
    CommunityModelProviderAdapter,
    CommunityRagAuthorizationAdapter,
    CommunityVerifiedExemplarUnavailableAdapter,
    CommunityCuratedScenarioExemplarUnavailableAdapter,
    CommunityExecutionContextAdapter,
    CommunityExecutionApprovalAdapter,
    CommunityExecutionConstitutionAdapter,
    CommunityPostExecutionMemoryAdapter,
    { provide: EXECUTION_ADMISSION_PORT, useExisting: CommunityExecutionAdmissionAdapter },
    { provide: EXECUTION_BUDGET_POLICY_PORT, useExisting: CommunityExecutionBudgetAdapter },
    { provide: EXECUTION_USAGE_PORT, useExisting: CommunityExecutionBudgetAdapter },
    { provide: BEHAVIOR_FEEDBACK_PORT, useExisting: CommunityBehaviorUnavailableAdapter },
    { provide: RUNTIME_BEHAVIOR_EVENT_PORT, useExisting: CommunityBehaviorUnavailableAdapter },
    { provide: AUTONOMY_GATE_PORT, useExisting: CommunityAutonomyGateAdapter },
    { provide: KNOWLEDGE_CONTEXT_PORT, useExisting: CommunityKnowledgeUnavailableAdapter },
    { provide: EXECUTOR_MODEL_PORT, useExisting: CommunityModelProviderAdapter },
    { provide: RAG_AUTHORIZATION_PORT, useExisting: CommunityRagAuthorizationAdapter },
    { provide: VERIFIED_EXEMPLAR_PORT, useExisting: CommunityVerifiedExemplarUnavailableAdapter },
    { provide: CURATED_SCENARIO_EXEMPLAR_PORT, useExisting: CommunityCuratedScenarioExemplarUnavailableAdapter },
    { provide: EXECUTION_CONTEXT_PORT, useExisting: CommunityExecutionContextAdapter },
    { provide: EXECUTION_APPROVAL_PORT, useExisting: CommunityExecutionApprovalAdapter },
    { provide: EXECUTION_CONSTITUTION_PORT, useExisting: CommunityExecutionConstitutionAdapter },
    { provide: POST_EXECUTION_MEMORY_PORT, useExisting: CommunityPostExecutionMemoryAdapter },
  ],
})
export class CommunityAgentRuntimeModule {}
