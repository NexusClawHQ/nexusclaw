/**
 * Core interfaces for Guardrail Engine & Audit Trail
 */

export interface ToolCallOperation {
  objectApiName?: string;
  operation?: string;
  fieldApiNames?: string[];
  amount?: number;
  batchSize?: number;
}

export interface GuardrailEvaluation {
  matched: boolean;
  ruleId?: string;
  ruleName?: string;
  riskLevel: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
  action: GuardrailActionResult;
}

export interface GuardrailActionResult {
  type: 'allow' | 'audit' | 'confirm' | 'approve' | 'block';
  blocked: boolean;
  escalated: boolean;
  logId?: string;
  approverRule?: string;
  timeoutMinutes?: number;
}

export interface AuditQueryFilters {
  workspaceId: string;
  agentId?: string;
  userId?: string;
  executionId?: string;
  traceId?: string;
  correlationId?: string;
  timeRangeStart?: Date;
  timeRangeEnd?: Date;
  riskLevel?: string;
  actionTaken?: string;
  approvalStatus?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogListItem {
  id: string;
  executionId?: string;
  ruleName?: string;
  riskLevel: string;
  operationType?: string;
  objectApiName?: string;
  actionTaken: string;
  approvalStatus?: string;
  createdAt: Date;
}

export interface ExecutionAuditDetail {
  executionId: string;
  agentName: string;
  triggerType: string;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  totalTokensInput: number;
  totalTokensOutput: number;
  steps: any[];
  toolCalls: any[];
  guardrailLogs: any[];
}

export interface GuardrailLogEntry {
  id: string;
  ruleId?: string;
  ruleName?: string;
  riskLevel: string;
  actionTaken: string;
  approvalStatus?: string;
  approverId?: string;
  approvedAt?: Date;
  context?: Record<string, any>;
  createdAt: Date;
}

export interface GuardrailStats {
  totalEvaluations: number;
  byRiskLevel: Record<string, number>;
  byAction: Record<string, number>;
  blockRate: number;
  avgApprovalTimeMinutes: number;
}
