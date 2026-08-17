import type { ApprovalStep } from './entities/approval-step.entity.js';
import type { ApprovalInstance } from './entities/approval-instance.entity.js';

/**
 * Framework-neutral seams of the approval decision core (the product wires
 * EventEmitter2, the guardrail audit logger, queue membership and a human
 * resolver through Nest).
 */

/** Event sink replacing EventEmitter2. */
export interface ApprovalEventsPort {
  emit(event: string, payload: Record<string, unknown>): void;
}

export const noopEvents: ApprovalEventsPort = { emit() {} };

/** Audit sink replacing the guardrail AuditLoggerService. */
export interface ApprovalAuditPort {
  logGuardrailEvent(input: Record<string, unknown>): Promise<void>;
  updateGuardrailLogByApprovalId(
    approvalId: string,
    patch: Record<string, unknown>,
  ): Promise<void>;
}

export const noopAudit: ApprovalAuditPort = {
  async logGuardrailEvent() {},
  async updateGuardrailLogByApprovalId() {},
};

/**
 * Approver check. Default: exact step.approverId match (queue membership and
 * org/role resolution stay product-side via custom implementations).
 */
export interface ApproverCheckPort {
  canApprove(step: ApprovalStep, approverId: string): Promise<boolean>;
}

export const exactApproverCheck: ApproverCheckPort = {
  async canApprove(step, approverId) {
    if (step.approverType === 'queue') return false;
    return step.approverId === approverId;
  },
};

export type { ApprovalInstance };
