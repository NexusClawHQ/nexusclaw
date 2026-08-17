export {
  ApprovalEngineService,
  ApprovalEngineOptions,
  AgentApprovalRequest,
  AGENT_SENSITIVE_OP_PROCESS_ID,
} from './approval-engine.js';
export type {
  ApprovalEventsPort,
  ApprovalAuditPort,
  ApproverCheckPort,
} from './ports.js';
export { noopEvents, noopAudit, exactApproverCheck } from './ports.js';
export { ApprovalInstance } from './entities/approval-instance.entity.js';
export type { ApprovalHistoryEntry, ApprovalAIMetadata } from './entities/approval-instance.entity.js';
export { ApprovalStep } from './entities/approval-step.entity.js';
export { ApprovalProcess } from './entities/approval-process.entity.js';
export { ApprovalPolicyRevisionEntity } from './entities/approval-policy-revision.entity.js';
export { generateId } from './generate-id.js';
