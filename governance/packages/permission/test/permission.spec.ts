import { describe, expect, it } from 'vitest';
import {
  ToolAccessService,
  resolveAllowedTools,
  evaluateConservativeRagAuthorization,
  DataScopeFilterService,
  FieldMaskingService,
  InvalidCustomFilterException,
} from '../src/index.js';

describe('ToolAccessService (deny by default)', () => {
  const service = new ToolAccessService();

  it('denies when the allow-list is empty unless explicitly allowed', () => {
    expect(service.checkToolAccess('record.query', [], [])).toBe(false);
    expect(service.checkToolAccess('record.query', null, null)).toBe(false);
    expect(service.checkToolAccess('record.query', undefined, undefined)).toBe(false);
    expect(service.checkToolAccess('record.query', [], [], { allowEmptyList: true })).toBe(true);
  });

  it('blocked tools take priority over the allow-list', () => {
    expect(service.checkToolAccess('record.delete', ['record.delete'], ['record.delete'])).toBe(false);
    expect(service.checkToolAccess('record.delete', [], ['record.delete'])).toBe(false);
  });

  it('allows tools present in a non-empty allow-list', () => {
    expect(service.checkToolAccess('record.query', ['record.query', 'email.draft'], [])).toBe(true);
    expect(service.checkToolAccess('report.generate', ['record.query'], [])).toBe(false);
  });
});

describe('resolveAllowedTools (no implicit grants)', () => {
  it('returns an empty allow-list when nothing is configured', () => {
    expect(resolveAllowedTools({})).toEqual([]);
  });

  it('prioritises extension grants over guardrail grants', () => {
    expect(resolveAllowedTools({
      extensionAllowedTools: ['ext.tool'],
      guardrailAllowedTools: ['guard.tool'],
    })).toEqual(['ext.tool']);
  });

  it('falls back to guardrail grants, then to explicitly provided defaults', () => {
    expect(resolveAllowedTools({ guardrailAllowedTools: ['guard.tool'] })).toEqual(['guard.tool']);
    expect(resolveAllowedTools({ defaultTools: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it('applies blocked tools last and never lets them through defaults', () => {
    expect(resolveAllowedTools({
      defaultTools: ['record.query', 'record.create'],
      blockedTools: ['record.create'],
    })).toEqual(['record.query']);
  });
});

describe('conservative RAG authorization', () => {
  const base = {
    workspaceId: 'ws-1',
    principalRoleId: 'role-1',
    agentId: 'agent-1',
    sourceRef: 'ref-1',
    sourceWorkspaceId: 'ws-1',
    sourceAccessLevel: 'public',
    principalOrgSubtreeIds: ['org-1'],
    readableObjectApiNames: ['Contact'],
  };

  it('denies cross-workspace sources', () => {
    const decision = evaluateConservativeRagAuthorization({
      ...base,
      sourceWorkspaceId: 'ws-2',
    });
    expect(decision).toMatchObject({ allowed: false, code: 'WORKSPACE_BOUNDARY_DENIED' });
  });

  it('denies when no principal role exists', () => {
    const decision = evaluateConservativeRagAuthorization({ ...base, principalRoleId: '' });
    expect(decision).toMatchObject({ allowed: false, code: 'AUTHORIZATION_POLICY_MISSING' });
  });

  it('denies object reads the role cannot see', () => {
    const decision = evaluateConservativeRagAuthorization({
      ...base,
      objectApiName: 'Opportunity',
    });
    expect(decision).toMatchObject({ allowed: false, code: 'OBJECT_READ_DENIED' });
  });

  it('does not gate source-type marker knowledge on object permissions', () => {
    const decision = evaluateConservativeRagAuthorization({
      ...base,
      sourceType: 'curated_scenario_exemplar',
      objectApiName: 'curated_scenario_exemplar',
    });
    expect(decision.allowed).toBe(true);
  });

  it('enforces the sharing gates and authorizes when satisfied', () => {
    const privateDenied = evaluateConservativeRagAuthorization({
      ...base,
      sourceAccessLevel: 'private',
      sourceCreatedBy: 'someone-else',
    });
    expect(privateDenied).toMatchObject({ allowed: false, code: 'AUTHORIZATION_DENIED' });

    const privateOwned = evaluateConservativeRagAuthorization({
      ...base,
      sourceAccessLevel: 'private',
      sourceCreatedBy: 'agent-1',
    });
    expect(privateOwned).toMatchObject({ allowed: true, code: 'AUTHORIZED' });

    const orgDenied = evaluateConservativeRagAuthorization({
      ...base,
      sourceAccessLevel: 'org_subtree',
      sourceOrgNodeId: 'org-9',
    });
    expect(orgDenied).toMatchObject({ allowed: false, code: 'AUTHORIZATION_DENIED' });
  });
});

describe('DataScopeFilterService', () => {
  const service = new DataScopeFilterService();

  it('builds clauses per scope type', () => {
    expect(service.buildWhereClause('all', {})).toEqual({ sql: '', params: [] });
    expect(service.buildWhereClause('org_subtree', { orgSubtreeIds: ['o1', 'o2'] }))
      .toEqual({ sql: 'org_node_id IN ($1, $2)', params: ['o1', 'o2'] });
    expect(service.buildWhereClause('org_subtree', {}))
      .toEqual({ sql: '1 = 0', params: [] });
    expect(service.buildWhereClause('own', { userId: 'u1' }))
      .toEqual({ sql: 'created_by = $1', params: ['u1'] });
  });

  it('rejects custom filters with non-whitelisted fields or bad syntax', () => {
    expect(() => service.buildWhereClause('custom', { customFilter: "id = '1' AND status = 'x'" }))
      .not.toThrow();
    expect(() => service.buildWhereClause('custom', { customFilter: "evil = '1'" }))
      .toThrow(InvalidCustomFilterException);
    expect(() => service.buildWhereClause('custom', { customFilter: 'id = 1' }))
      .toThrow(InvalidCustomFilterException);
    expect(() => service.buildWhereClause('custom', { customFilter: '' }))
      .toThrow(InvalidCustomFilterException);
  });
});

describe('FieldMaskingService', () => {
  const service = new FieldMaskingService();

  it('hides, partially masks, hashes and ranges without mutating input', () => {
    const records = [{ id: '1', phone: '5550001234', email: 'a@example.com', amount: 135 }];
    const rules = [
      { objectApiName: 'Contact', fieldApiName: 'email', maskType: 'hide', maskConfig: {} },
      { objectApiName: 'Contact', fieldApiName: 'phone', maskType: 'partial', maskConfig: { prefixLength: 3, suffixLength: 2 } },
      { objectApiName: 'Contact', fieldApiName: 'amount', maskType: 'range', maskConfig: { bucketSize: 50, unit: 'k' } },
    ] as any;

    const masked = service.applyMasks(records, rules, 'Contact');
    expect(masked[0]).not.toHaveProperty('email');
    expect(masked[0]!.phone).toBe('555*****34');
    expect(masked[0]!.amount).toBe('100-150k');
    expect(records[0]).toHaveProperty('email'); // input untouched
  });

  it('hashes with sha256 default and md5 option', () => {
    const sha = service.applyHashMask('hello', { algorithm: 'sha256', truncateLength: 8 });
    expect(sha).toMatch(/^[0-9a-f]{8}$/);
    const md5 = service.applyHashMask('hello', { algorithm: 'md5' });
    expect(md5).toMatch(/^[0-9a-f]{32}$/);
  });
});
