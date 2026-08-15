import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestActorType =
  | 'anonymous'
  | 'human_user'
  | 'human_admin'
  | 'agent'
  | 'system_job';

export type GovernedRecordMutationParentV1 =
  | {
      readonly kind: 'agent';
      readonly agentExecutionId: string;
      readonly reactStepId?: string;
    }
  | {
      readonly kind: 'flow';
      readonly flowExecutionId: string;
      readonly flowStepLogId: string;
      readonly flowVersionId: string;
      readonly flowNodeId: string;
    };

export interface GovernedRecordMutationLineageV1 {
  readonly schemaVersion: 'nexusclaw.record-mutation-lineage/v1';
  readonly sourceWorkspaceId: string;
  readonly executionWorkspaceId: string;
  readonly releaseSetId: string;
  readonly toolCallId: string;
  readonly functionExecutionId: string;
  readonly functionRevisionId: string;
  readonly publishedChecksum: `sha256:${string}`;
  readonly callOrdinal: number;
  readonly idempotencyKeyHash: string;
  readonly parent: GovernedRecordMutationParentV1;
  readonly traceId: string;
  readonly correlationId: string;
}

export interface GovernedRecordMutationEventMetadataV1 {
  sourceWorkspaceId: string;
  releaseSetId: string;
  toolCallId: string;
  functionExecutionId: string;
  functionRevisionId: string;
  publishedChecksum: `sha256:${string}`;
  callOrdinal: number;
  idempotencyKeyHash: string;
  parentKind: 'agent' | 'flow';
  parentExecutionId: string;
}

export interface RequestTraceContext {
  traceId: string;
  correlationId: string;
  executionId?: string;
  actorType: RequestActorType;
  actorId?: string;
  workspaceId?: string;
  source: string;
  requestPath?: string;
  requestMethod?: string;
  /**
   * Effective role of the acting principal, when it is known explicitly and
   * differs from "resolve the role of `actorId`'s user row". Set by callers
   * whose principal is not a user — e.g. the MCP server, whose API-key role IS
   * its identity (docs/specs/mcp-server-v2 P0-A). FLS write enforcement prefers
   * this over resolving a role from the actor's userId, so MCP writes are gated
   * by the SAME role as MCP reads. Absent for ordinary user/admin requests,
   * which keep resolving the role from their userId.
   */
  roleId?: string;
  /**
   * Server-built executable record-write lineage. Legacy human/static callers
   * never set this extension and executable code cannot supply it.
   */
  governedMutation?: Readonly<GovernedRecordMutationLineageV1>;
}

export interface TraceMetadata {
  traceId?: string;
  correlationId?: string;
  executionId?: string;
  actorType?: RequestActorType | string;
  actorId?: string;
  workspaceId?: string;
  source?: string;
}

export interface AsyncTraceCarrier {
  traceId?: string;
  correlationId?: string;
  executionId?: string;
  actorType?: RequestActorType | string;
  actorId?: string;
  workspaceId?: string;
  source?: string;
  requestPath?: string;
  requestMethod?: string;
}

export type TraceCarrier = AsyncTraceCarrier;

const requestContextStorage = new AsyncLocalStorage<RequestTraceContext>();

function normalizeSingleHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

function inferSource(req: Request): string {
  const path = req.originalUrl || req.path || req.url || '';

  if (path.startsWith('/graphql')) {
    return 'graphql';
  }
  if (path.startsWith('/api/')) {
    return 'api';
  }
  if (path.startsWith('/health')) {
    return 'health';
  }

  return 'http';
}

function inferActorType(req: Request): RequestActorType {
  const normalizedHeaderActorType = normalizeActorType(
    normalizeSingleHeaderValue(req.headers['x-actor-type']),
  );
  if (normalizedHeaderActorType) {
    return normalizedHeaderActorType;
  }

  if (normalizeSingleHeaderValue(req.headers['x-agent-id'])) {
    return 'agent';
  }

  if ((req as any).apiKeyContext?.apiKeyId) {
    return 'system_job';
  }

  if ((req as any).user?.id) {
    const roleName = String((req as any).user?.role?.name ?? '').toLowerCase();
    const roleKey = String((req as any).user?.role?.key ?? '').toLowerCase();
    if (
      (req as any).user?.isAdmin === true ||
      roleName.includes('admin') ||
      roleKey.includes('admin')
    ) {
      return 'human_admin';
    }
    return 'human_user';
  }

  return 'anonymous';
}

function normalizeActorType(
  actorType: string | undefined,
): RequestActorType | undefined {
  if (
    actorType === 'human_user' ||
    actorType === 'human_admin' ||
    actorType === 'agent' ||
    actorType === 'system_job' ||
    actorType === 'anonymous'
  ) {
    return actorType;
  }

  return undefined;
}

export function getRequestContext(): RequestTraceContext | null {
  return requestContextStorage.getStore() ?? null;
}

export function getGovernedRecordMutationEventMetadata():
  | GovernedRecordMutationEventMetadataV1
  | undefined {
  const lineage = getRequestContext()?.governedMutation;
  if (!lineage) {
    return undefined;
  }
  return {
    sourceWorkspaceId: lineage.sourceWorkspaceId,
    releaseSetId: lineage.releaseSetId,
    toolCallId: lineage.toolCallId,
    functionExecutionId: lineage.functionExecutionId,
    functionRevisionId: lineage.functionRevisionId,
    publishedChecksum: lineage.publishedChecksum,
    callOrdinal: lineage.callOrdinal,
    idempotencyKeyHash: lineage.idempotencyKeyHash,
    parentKind: lineage.parent.kind,
    parentExecutionId:
      lineage.parent.kind === 'agent'
        ? lineage.parent.agentExecutionId
        : lineage.parent.flowExecutionId,
  };
}

export function getTraceMetadata(
  overrides: Partial<TraceMetadata> = {},
): TraceMetadata {
  const context = getRequestContext();

  return withoutUndefined({
    traceId: context?.traceId,
    correlationId: context?.correlationId ?? context?.traceId,
    executionId: context?.executionId,
    actorType: context?.actorType,
    actorId: context?.actorId,
    workspaceId: context?.workspaceId,
    source: context?.source,
    ...overrides,
  });
}

export function updateRequestContext(
  patch: Partial<RequestTraceContext>,
): RequestTraceContext | null {
  const current = requestContextStorage.getStore();
  if (!current) {
    return null;
  }
  Object.assign(current, patch);
  return current;
}

function withoutUndefined<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export function syncRequestContextFromRequest(
  req: Request,
  overrides: Partial<RequestTraceContext> = {},
): RequestTraceContext | null {
  const actorId =
    normalizeSingleHeaderValue(req.headers['x-actor-id']) ??
    ((req as any).user?.id as string | undefined) ??
    ((req as any).apiKeyContext?.apiKeyId as string | undefined);
  const workspaceId =
    normalizeSingleHeaderValue(req.headers['x-workspace-id']) ??
    ((req as any).user?.defaultWorkspaceId as string | undefined) ??
    ((req as any).user?.tenantId as string | undefined) ??
    ((req as any).apiKeyContext?.workspaceId as string | undefined);

  return updateRequestContext(
    withoutUndefined({
      actorType: inferActorType(req),
      actorId,
      workspaceId,
      source: inferSource(req),
      requestPath: req.originalUrl || req.path || req.url,
      requestMethod: req.method,
      ...overrides,
    }),
  );
}

export function runWithRequestContext<T>(
  context: RequestTraceContext,
  callback: () => T,
): T {
  return requestContextStorage.run(context, callback);
}

export function buildRequestContext(
  trace: TraceCarrier = {},
  options: {
    generateNewTraceId?: boolean;
    defaultSource?: string;
    defaultActorType?: RequestActorType;
    defaultActorId?: string;
    workspaceId?: string;
    correlationId?: string;
  } = {},
): RequestTraceContext {
  const traceId =
    options.generateNewTraceId === true
      ? randomUUID()
      : trace.traceId ?? randomUUID();
  const correlationId =
    options.correlationId ?? trace.correlationId ?? trace.traceId ?? traceId;

  return {
    traceId,
    correlationId,
    executionId: trace.executionId,
    actorType:
      normalizeActorType(trace.actorType) ??
      options.defaultActorType ??
      'system_job',
    actorId: trace.actorId ?? options.defaultActorId,
    workspaceId: trace.workspaceId ?? options.workspaceId,
    source: trace.source ?? options.defaultSource ?? 'async',
    requestPath:
      'requestPath' in trace ? trace.requestPath : undefined,
    requestMethod:
      'requestMethod' in trace ? trace.requestMethod : undefined,
  };
}

export function runWithTraceContext<T>(
  trace: TraceCarrier | null | undefined,
  callback: () => T,
  options?: Parameters<typeof buildRequestContext>[1],
): T {
  return runWithRequestContext(buildRequestContext(trace ?? {}, options), callback);
}

/**
 * Bind a native Agent execution's principal into the async-local request
 * context for the duration of `callback` (remediation G-P0-02 / task 1.8).
 *
 * The write-path field-level security gate (`RecordFieldPolicyAspect.
 * enforceWriteFieldSecurity`) derives the acting role from
 * `getRequestContext().roleId` and only fires when `actorType` is
 * `human_user|human_admin|agent`. Native Agent runs previously left no
 * request context on the ALS, so writes silently skipped FLS (fail-open).
 *
 * This helper establishes the request context from the already-resolved
 * native principal (`roleId`, `agentId`, `workspaceId`) so the write-path FLS
 * gate sees a real `agent` actor and enforces. It does NOT synthesise a
 * system identity — callers must supply a non-empty `roleId`/`agentId`/
 * `workspaceId` (the ContextBuilder's fail-closed principal guarantees this).
 */
export function runWithAgentRequestContext<T>(
  principal: {
    agentId: string;
    roleId: string;
    workspaceId: string;
    executionId?: string;
    traceId?: string;
    correlationId?: string;
    orgNodeId?: string;
  },
  callback: () => T,
): T {
  const context: RequestTraceContext = {
    traceId: principal.traceId ?? randomUUID(),
    correlationId: principal.correlationId ?? principal.traceId ?? randomUUID(),
    executionId: principal.executionId,
    actorType: 'agent',
    actorId: principal.agentId,
    workspaceId: principal.workspaceId,
    source: 'agent-runtime',
    roleId: principal.roleId,
  };
  return runWithRequestContext(context, callback);
}

/**
 * Imperatively enter a native Agent request context onto the async-local
 * store for the remainder of the current async chain (remediation G-P0-02 /
 * task 1.8). Use this at the start of a long executor method where wrapping
 * the whole body in {@link runWithAgentRequestContext} would be impractical.
 *
 * Same principal contract as {@link runWithAgentRequestContext}: a real
 * fail-closed native principal is required — never a synthesised system
 * identity.
 */
export function enterAgentRequestContext(principal: {
  agentId: string;
  roleId: string;
  workspaceId: string;
  executionId?: string;
  traceId?: string;
  correlationId?: string;
}): void {
  const context: RequestTraceContext = {
    traceId: principal.traceId ?? randomUUID(),
    correlationId: principal.correlationId ?? principal.traceId ?? randomUUID(),
    executionId: principal.executionId,
    actorType: 'agent',
    actorId: principal.agentId,
    workspaceId: principal.workspaceId,
    source: 'agent-runtime',
    roleId: principal.roleId,
  };
  requestContextStorage.enterWith(context);
}

export function createRequestContextMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const traceId =
      normalizeSingleHeaderValue(req.headers['x-trace-id']) ?? randomUUID();
    const correlationId =
      normalizeSingleHeaderValue(req.headers['x-correlation-id']) ?? traceId;
    const actorId =
      normalizeSingleHeaderValue(req.headers['x-actor-id']) ??
      ((req as any).user?.id as string | undefined);
    const workspaceId =
      normalizeSingleHeaderValue(req.headers['x-workspace-id']) ??
      ((req as any).user?.defaultWorkspaceId as string | undefined) ??
      ((req as any).user?.tenantId as string | undefined);

    const context: RequestTraceContext = {
      traceId,
      correlationId,
      actorType: inferActorType(req),
      actorId,
      workspaceId,
      source: inferSource(req),
      requestPath: req.originalUrl || req.path || req.url,
      requestMethod: req.method,
    };

    return requestContextStorage.run(context, () => {
      (req as any).requestContext = context;
      syncRequestContextFromRequest(req);
      res.setHeader('x-trace-id', context.traceId);
      res.setHeader('x-correlation-id', context.correlationId);
      next();
    });
  };
}
