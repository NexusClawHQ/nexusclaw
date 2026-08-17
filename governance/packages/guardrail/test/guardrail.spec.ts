import { describe, expect, it } from 'vitest';
import {
  RuleMatcherService,
  RiskAssessorService,
  GuardrailEngineService,
  InMemoryRuleProvider,
  extractOperation,
} from '../src/index.js';
import type { GuardrailRule } from '../src/index.js';

const rule = (overrides: Partial<GuardrailRule> & { id: string }): GuardrailRule =>
  ({
    workspaceId: 'ws-1',
    name: 'rule',
    riskLevel: 'L1',
    priority: 100,
    isActive: true,
    conditions: {},
    ...overrides,
  }) as GuardrailRule;

describe('RuleMatcherService (AND logic, wildcard conditions)', () => {
  const matcher = new RuleMatcherService();

  it('matches empty conditions', () => {
    expect(matcher.matchRules(
      { objectApiName: 'Contact', operation: 'update' },
      [rule({ id: 'r1', conditions: {} })],
    )).toHaveLength(1);
  });

  it('requires every specified condition to hold (AND)', () => {
    const r = rule({
      id: 'r1',
      conditions: {
        objectApiName: 'Contact',
        operation: 'update',
        amountThreshold: 100,
      },
    });
    expect(matcher.matchRules(
      { objectApiName: 'Contact', operation: 'update', amount: 200 },
      [r],
    )).toHaveLength(1);
    expect(matcher.matchRules(
      { objectApiName: 'Contact', operation: 'delete', amount: 200 },
      [r],
    )).toHaveLength(0);
    expect(matcher.matchRules(
      { objectApiName: 'Contact', operation: 'update', amount: 50 },
      [r],
    )).toHaveLength(0);
  });

  it('requires field intersection for field conditions', () => {
    const r = rule({ id: 'r1', conditions: { fieldApiNames: ['email', 'phone'] } });
    expect(matcher.matchRules(
      { objectApiName: 'Contact', operation: 'update', fieldApiNames: ['email'] },
      [r],
    )).toHaveLength(1);
    expect(matcher.matchRules(
      { objectApiName: 'Contact', operation: 'update', fieldApiNames: ['name'] },
      [r],
    )).toHaveLength(0);
  });
});

describe('RiskAssessorService (highest risk, lowest priority tie-break)', () => {
  const assessor = new RiskAssessorService();

  it('returns null for no matches', () => {
    expect(assessor.assessRisk([])).toBeNull();
  });

  it('picks the highest risk level', () => {
    const r1 = rule({ id: 'r1', riskLevel: 'L1', priority: 1 });
    const r4 = rule({ id: 'r4', riskLevel: 'L4', priority: 500 });
    expect(assessor.assessRisk([r1, r4])).toBe(r4);
  });

  it('breaks ties by lowest priority number', () => {
    const a = rule({ id: 'a', riskLevel: 'L3', priority: 50 });
    const b = rule({ id: 'b', riskLevel: 'L3', priority: 10 });
    expect(assessor.assessRisk([a, b])).toBe(b);
  });
});

describe('GuardrailEngineService (L0–L4 evaluation)', () => {
  const rules = [
    rule({ id: 'l1', riskLevel: 'L1', priority: 1, conditions: { operation: 'record.query' } }),
    rule({ id: 'l2', riskLevel: 'L2', priority: 2, conditions: { operation: 'record.update' } }),
    rule({ id: 'l3', riskLevel: 'L3', priority: 3, conditions: { operation: 'email.send' } }),
    rule({ id: 'l4', riskLevel: 'L4', priority: 4, conditions: { operation: 'record.delete' } }),
  ];
  const engine = new GuardrailEngineService(new InMemoryRuleProvider(rules));

  it('allows L0 when nothing matches', async () => {
    const result = await engine.evaluate('ws-1', 'record.query', { operation: 'report.generate' });
    expect(result).toMatchObject({ matched: false, riskLevel: 'L0', action: { type: 'allow' } });
  });

  it('maps each risk level to its action', async () => {
    expect(await engine.evaluate('ws-1', 'record.query', {})).toMatchObject({
      matched: true, riskLevel: 'L1', action: { type: 'audit', blocked: false },
    });
    expect(await engine.evaluate('ws-1', 'record.update', {})).toMatchObject({
      matched: true, riskLevel: 'L2', action: { type: 'confirm', escalated: true },
    });
    expect(await engine.evaluate('ws-1', 'email.send', {})).toMatchObject({
      matched: true, riskLevel: 'L3', action: { type: 'approve', escalated: true },
    });
    expect(await engine.evaluate('ws-1', 'record.delete', {})).toMatchObject({
      matched: true, riskLevel: 'L4', action: { type: 'block', blocked: true },
    });
  });

  it('scopes evaluation to agent-bound rule ids', async () => {
    const result = await engine.evaluate('ws-1', 'email.send', {}, ['l4']);
    expect(result).toMatchObject({ matched: false, riskLevel: 'L0' });
    const scoped = await engine.evaluate('ws-1', 'record.delete', {}, ['l4']);
    expect(scoped).toMatchObject({ matched: true, riskLevel: 'L4' });
  });

  it('extracts the operation from tool input', () => {
    expect(extractOperation('record.update', {
      objectApiName: 'Contact',
      fields: { name: 'x', phone: 'y' },
      amount: 42,
      records: [1, 2, 3],
    })).toEqual({
      objectApiName: 'Contact',
      operation: 'record.update',
      fieldApiNames: ['name', 'phone'],
      amount: 42,
      batchSize: 3,
    });
  });
});
