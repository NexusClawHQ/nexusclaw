import type { ExecutionStatus } from '@agent-governance/contracts';

/**
 * Execution State Machine
 *
 * Defines valid state transitions for AgentExecution.
 * Prevents illegal transitions and ensures terminal states are immutable.
 */

// Valid state transitions map
const VALID_TRANSITIONS: Record<ExecutionStatus, ExecutionStatus[]> = {
  // The executor creates the row as `pending` and runs the ReAct loop in
  // memory without ever persisting `running` (terminal closeouts are written
  // directly via repo update). When a guardrail/approval fires mid-run the DB
  // row is therefore still `pending`, so `pending → guardrail_pending` must be
  // legal — otherwise a legitimate guardrail-triggering task errors out with
  // "illegal state transition" instead of being held for approval.
  pending: ['running', 'guardrail_pending', 'cancelled'],
  running: ['done', 'failed', 'timeout', 'guardrail_pending', 'cancelled'],
  guardrail_pending: ['running', 'failed', 'cancelled'],
  done: [],       // terminal
  failed: [],     // terminal
  timeout: [],    // terminal
  cancelled: [],  // terminal
};

export class ExecutionStateMachine {
  /**
   * Check if a state transition is valid.
   */
  static isValidTransition(from: ExecutionStatus, to: ExecutionStatus): boolean {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed) return false;
    return allowed.includes(to);
  }

  /**
   * Execute a state transition. Throws if transition is illegal.
   */
  static handleStateTransition(
    currentStatus: ExecutionStatus,
    newStatus: ExecutionStatus,
  ): ExecutionStatus {
    if (!this.isValidTransition(currentStatus, newStatus)) {
      throw new IllegalStateTransitionError(currentStatus, newStatus);
    }
    return newStatus;
  }

  /**
   * Check if a status is a terminal state.
   */
  static isTerminal(status: ExecutionStatus): boolean {
    return VALID_TRANSITIONS[status]?.length === 0;
  }
}

export class IllegalStateTransitionError extends Error {
  constructor(from: ExecutionStatus, to: ExecutionStatus) {
    super(`Illegal state transition: ${from} → ${to}`);
    this.name = 'IllegalStateTransitionError';
  }
}
