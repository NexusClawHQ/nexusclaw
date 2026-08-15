import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuardrailLog } from '../entities/guardrail-log.entity';

/**
 * Audit Logger Service
 *
 * Writes immutable guardrail audit records and updates approval fields.
 * Also handles CoT evidence and security context snapshots.
 */
@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);

  constructor(
    @InjectRepository(GuardrailLog)
    private readonly logRepo: Repository<GuardrailLog>,
  ) {}

  /** Write a guardrail event log entry, returns the log ID */
  async logGuardrailEvent(data: {
    workspaceId: string;
    executionId?: string;
    ruleId?: string;
    ruleName?: string;
    riskLevel: string;
    operationType?: string;
    objectApiName?: string;
    fieldApiNames?: string[];
    actionTaken: string;
    approvalId?: string;
    approvalStatus?: string;
    context?: Record<string, any>;
  }): Promise<string> {
    const log = this.logRepo.create(data as any);
    const saved = await this.logRepo.save(log);
    const result = Array.isArray(saved) ? saved[0] : saved;
    return result.id;
  }

  /** Update approval-related fields on a guardrail log */
  async updateGuardrailLog(logId: string, updates: {
    approvalStatus?: string;
    approverId?: string;
    approvedAt?: Date;
    approvalId?: string;
  }): Promise<void> {
    await this.logRepo.update(logId, updates as any);
  }

  /** Update guardrail log entries linked to an approval instance */
  async updateGuardrailLogByApprovalId(
    approvalId: string,
    updates: {
      approvalStatus?: string;
      approverId?: string;
      approvedAt?: Date;
    },
  ): Promise<void> {
    await this.logRepo.update({ approvalId } as any, updates as any);
  }

  /** Save CoT evidence to execution_logs */
  async saveCoTEvidence(executionLogId: string, chainOfThought: any): Promise<void> {
    // Uses raw query since execution_logs entity is in another module
    try {
      await this.logRepo.query(
        `UPDATE execution_logs SET chain_of_thought = $1 WHERE id = $2`,
        [JSON.stringify(chainOfThought), executionLogId],
      );
    } catch (err) {
      this.logger.warn('Failed to save CoT evidence', err);
    }
  }

  /** Save security context snapshot to execution_logs */
  async saveSecuritySnapshot(executionLogId: string, snapshot: any): Promise<void> {
    try {
      await this.logRepo.query(
        `UPDATE execution_logs SET security_context_snapshot = $1 WHERE id = $2`,
        [JSON.stringify(snapshot), executionLogId],
      );
    } catch (err) {
      this.logger.warn('Failed to save security snapshot', err);
    }
  }
}
