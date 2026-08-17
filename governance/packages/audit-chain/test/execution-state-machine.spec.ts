import { describe, expect, it } from 'vitest';
import {
  ExecutionStateMachine,
  IllegalStateTransitionError,
} from '../src/execution-state-machine.js';
import type { ExecutionStatus } from '@agent-governance/contracts';

describe('ExecutionStateMachine', () => {
  it('allows legal transitions', () => {
    expect(ExecutionStateMachine.handleStateTransition('pending', 'running')).toBe('running');
    expect(ExecutionStateMachine.handleStateTransition('pending', 'guardrail_pending')).toBe('guardrail_pending');
    expect(ExecutionStateMachine.handleStateTransition('guardrail_pending', 'running')).toBe('running');
    expect(ExecutionStateMachine.handleStateTransition('running', 'done')).toBe('done');
    expect(ExecutionStateMachine.handleStateTransition('running', 'failed')).toBe('failed');
    expect(ExecutionStateMachine.handleStateTransition('running', 'guardrail_pending')).toBe('guardrail_pending');
    expect(ExecutionStateMachine.handleStateTransition('pending', 'cancelled')).toBe('cancelled');
  });

  it('rejects illegal transitions', () => {
    const illegal: Array<[ExecutionStatus, ExecutionStatus]> = [
      ['done', 'running'],
      ['done', 'failed'],
      ['failed', 'cancelled'],
      ['cancelled', 'done'],
      ['timeout', 'running'],
      ['running', 'pending'],
    ];
    for (const [from, to] of illegal) {
      expect(() => ExecutionStateMachine.handleStateTransition(from, to)).toThrow(
        IllegalStateTransitionError,
      );
    }
  });

  it('treats terminal states as immutable', () => {
    for (const status of ['done', 'failed', 'timeout', 'cancelled'] as const) {
      expect(ExecutionStateMachine.isTerminal(status)).toBe(true);
    }
    expect(ExecutionStateMachine.isTerminal('running')).toBe(false);
    expect(ExecutionStateMachine.isTerminal('guardrail_pending')).toBe(false);
  });

  it('guardrail_pending resumes to running and can fail honestly', () => {
    expect(ExecutionStateMachine.isValidTransition('guardrail_pending', 'running')).toBe(true);
    expect(ExecutionStateMachine.isValidTransition('guardrail_pending', 'failed')).toBe(true);
  });
});
