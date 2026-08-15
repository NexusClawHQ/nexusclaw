import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  In,
  IsNull,
  MoreThan,
  Repository,
} from 'typeorm';
import {
  canonicalJsonDigest,
  canonicalJsonString,
  isJsonValue,
  type AgentCodeToolExportV1,
  type JsonValue,
  type ResolvedAgentExecutableToolV1,
} from '@nexusclaw/shared/agent-executable-assets';

import { generateId } from '../../../common/utils/generate-id';
import { redactSensitivePayload } from '../../../common/security/redact-sensitive-payload';
import { applyJsonRedactionPointers } from '../../../common/security/apply-json-redaction-pointers';
import {
  ToolCallRecord,
  ToolCallStatus,
} from '../entities/tool-call-record.entity';
import type {
  AgentExecutionContext,
  GovernedToolExecutionContextV1,
} from '../interfaces';

const MAX_PREVIEW_BYTES = 8 * 1024;

export interface ToolCallBeginInput {
  readonly id?: string;
  readonly toolName: string;
  readonly toolCategory: string;
  readonly input: unknown;
  readonly context:
    | AgentExecutionContext
    | GovernedToolExecutionContextV1;
  readonly resolvedTool?: ResolvedAgentExecutableToolV1;
}

export interface ToolCallFinalizeInput {
  readonly status:
    | ToolCallStatus.SUCCEEDED
    | ToolCallStatus.FAILED
    | ToolCallStatus.COMPLETION_UNKNOWN;
  readonly output?: unknown;
  readonly permissionCheck: 'passed' | 'denied';
  readonly permissionDetail?: string;
  readonly guardrailCheck: 'passed' | 'escalated' | 'blocked';
  readonly durationMs: number;
  readonly errorCode?: string;
}

export interface ToolCallResumeApprovedInput {
  readonly toolName: string;
  readonly input: unknown;
  readonly context: GovernedToolExecutionContextV1;
  readonly resolvedTool: ResolvedAgentExecutableToolV1;
  readonly grant: Readonly<{
    toolName: string;
    approvalInstanceId: string;
    toolCallId?: string;
    inputDigest?: string;
    releaseSetId?: string;
    publishedChecksum?: string;
  }>;
}

export interface StaticConnectorBindingSnapshotV1 {
  readonly workspaceId: string;
  readonly toolCallId: string;
  readonly agentExecutionId: string;
  readonly staticToolCode: 'slack.message.send' | 'teams.message.send';
  readonly revisionId: string;
  readonly checksum: string;
  readonly generation: string;
}

export interface StaticToolCallResumeApprovedInput {
  readonly toolName: 'slack.message.send' | 'teams.message.send';
  readonly input: unknown;
  readonly context: AgentExecutionContext;
  readonly grant: Readonly<{
    toolName: string;
    approvalInstanceId: string;
    toolCallId?: string;
    inputDigest?: string;
  }>;
}

/**
 * Sole physical ToolCallRecord writer. ToolRegistry orchestrates the state
 * machine but every insert/update (including future shared transactions)
 * enters through this service.
 */
@Injectable()
export class ToolCallLifecycleService {
  constructor(
    @InjectRepository(ToolCallRecord)
    private readonly records: Repository<ToolCallRecord>,
  ) {}

  deriveInputDigest(input: unknown): `sha256:${string}` {
    return buildPreview(input, undefined, 'input').digest;
  }

  async begin(
    input: ToolCallBeginInput,
    manager?: EntityManager,
  ): Promise<ToolCallRecord> {
    const repo = this.repo(manager);
    const governedContext = isGovernedContext(input.context)
      ? input.context
      : null;
    const legacyContext = isLegacyContext(input.context)
      ? input.context
      : null;
    const governed = input.resolvedTool !== undefined;
    if (
      (governed && !governedContext) ||
      (!governed && !legacyContext)
    ) {
      throw new Error('TOOL_CALL_RESOLUTION_CONTEXT_MISMATCH');
    }
    const preview = buildPreview(
      input.input,
      input.resolvedTool?.exportDescriptor,
      'input',
    );
    const startedAt = new Date();
    const base = {
      id: input.id ?? generateId(),
      createdAt: startedAt,
      toolName: input.toolName,
      toolCategory: input.toolCategory,
      status: ToolCallStatus.STARTED,
      inputDigest: preview.digest,
      input: preview.value,
      output: null,
      redactionApplied: true,
      attempt: 0,
      lastHeartbeatAt: startedAt,
      leaseExpiresAt: new Date(
        startedAt.getTime() +
          Math.max(1, input.context.constraints.timeoutMs),
      ),
      permissionCheck: null,
      guardrailCheck: null,
      durationMs: 0,
      traceId: input.context.traceId,
      correlationId:
        input.context.correlationId ?? input.context.traceId,
    };
    const record = repo.create(
      (governed
        ? {
            ...base,
            executionId: null,
            workspaceId: governedContext!.release.executionWorkspaceId,
            sourceWorkspaceId: governedContext!.release.sourceWorkspaceId,
            resolutionMode: governedContext!.release.mode,
            candidateIsolationBindingId:
              governedContext!.release.isolationBinding?.isolationBindingId ??
              null,
            candidateIsolationSnapshotHash:
              governedContext!.release.isolationBinding
                ?.isolationSnapshotHash ?? null,
            releaseSetId: governedContext!.release.releaseSetId,
            functionRevisionId: input.resolvedTool!.functionRevisionId,
            descriptorHash: input.resolvedTool!.descriptorHash,
            publishedChecksum: input.resolvedTool!.publishedChecksum,
            runtimeProviderId: input.resolvedTool!.runtimeProviderId,
            actorType: governedContext!.principal.actorType,
            actorId: governedContext!.principal.serviceIdentityId,
            source: 'agent_executable_tool',
            ...(governedContext!.parent.kind === 'agent'
              ? {
                  agentExecutionId:
                    governedContext!.parent.agentExecutionId,
                  stepId: governedContext!.parent.reactStepId ?? null,
                  flowExecutionId: null,
                  flowStepLogId: null,
                  flowVersionId: null,
                  flowNodeId: null,
                }
              : {
                  agentExecutionId: null,
                  stepId: null,
                  flowExecutionId:
                    governedContext!.parent.flowExecutionId,
                  flowStepLogId:
                    governedContext!.parent.flowStepLogId,
                  flowVersionId:
                    governedContext!.parent.flowVersionId,
                  flowNodeId: governedContext!.parent.flowNodeId,
                }),
          }
        : {
            ...base,
            executionId: legacyContext!.executionId || null,
            workspaceId: legacyContext!.workspaceId,
            agentExecutionId: legacyContext!.executionId || null,
            actorType: legacyContext!.actorType,
            actorId:
              legacyContext!.actorId ?? legacyContext!.triggeredBy,
            source: legacyContext!.source,
        }) as any,
    );
    const saved = await repo.save(record);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async transition(
    id: string,
    expected: readonly ToolCallStatus[],
    status: ToolCallStatus,
    patch: Partial<ToolCallRecord> = {},
    manager?: EntityManager,
  ): Promise<void> {
    const result = await this.repo(manager).update(
      { id, status: In([...expected]) },
      {
        ...patch,
        status,
      } as any,
    );
    if (result.affected !== 1) {
      throw new Error(`TOOL_CALL_STATE_CONFLICT:${id}:${status}`);
    }
  }

  /**
   * Snapshot the exact immutable Slack/Teams binding before the L3 approval is
   * created. First writer wins; an exact replay is allowed and any different
   * snapshot is rejected instead of silently switching connector instances.
   */
  async bindStaticConnectorSnapshot(
    input: StaticConnectorBindingSnapshotV1,
    manager?: EntityManager,
  ): Promise<ToolCallRecord> {
    if (
      !/^sha256:[0-9a-f]{64}$/.test(input.checksum) ||
      !/^[1-9][0-9]*$/.test(input.generation)
    ) {
      throw new Error('STATIC_CONNECTOR_BINDING_SNAPSHOT_INVALID');
    }
    const repo = this.repo(manager);
    const current = await repo.findOne({
      where: {
        id: input.toolCallId,
        workspaceId: input.workspaceId,
        agentExecutionId: input.agentExecutionId,
      },
    });
    if (
      !current ||
      current.toolName !== input.staticToolCode ||
      current.status !== ToolCallStatus.STARTED
    ) {
      throw new Error('STATIC_CONNECTOR_TOOL_CALL_NOT_PREPARABLE');
    }
    if (current.staticBindingRevisionId) {
      this.assertStaticBindingSnapshot(current, input);
      return current;
    }
    const result = await repo.update(
      {
        id: input.toolCallId,
        workspaceId: input.workspaceId,
        agentExecutionId: input.agentExecutionId,
        status: ToolCallStatus.STARTED,
        staticBindingRevisionId: IsNull(),
      },
      {
        staticBindingRevisionId: input.revisionId,
        staticBindingChecksum: input.checksum,
        staticBindingGeneration: input.generation,
      },
    );
    const persisted = await repo.findOne({
      where: {
        id: input.toolCallId,
        workspaceId: input.workspaceId,
        agentExecutionId: input.agentExecutionId,
      },
    });
    if (!persisted || (!result.affected && !persisted.staticBindingRevisionId)) {
      throw new Error('STATIC_CONNECTOR_BINDING_SNAPSHOT_CONFLICT');
    }
    this.assertStaticBindingSnapshot(persisted, input);
    return persisted;
  }

  /**
   * Sole static connector ordinal allocator. Static adapters make exactly one
   * subcall, so the first digest receives ordinal 1, the same digest replays
   * ordinal 1, and a second digest is a hard conflict.
   */
  async allocateSubcallOrdinal(
    toolCallId: string,
    kind: 'static_connector',
    requestDigest: string,
    manager?: EntityManager,
  ): Promise<1> {
    if (
      kind !== 'static_connector' ||
      !/^sha256:[0-9a-f]{64}$/.test(requestDigest)
    ) {
      throw new Error('STATIC_CONNECTOR_SUBCALL_INVALID');
    }
    const repo = this.repo(manager);
    const current = await repo.findOne({ where: { id: toolCallId } });
    if (!current || current.status !== ToolCallStatus.RUNNING) {
      throw new Error('STATIC_CONNECTOR_TOOL_CALL_NOT_RUNNING');
    }
    if (current.staticConnectorSubcallOrdinal !== null &&
        current.staticConnectorSubcallOrdinal !== undefined) {
      if (
        current.staticConnectorSubcallOrdinal !== 1 ||
        current.staticConnectorRequestDigest !== requestDigest
      ) {
        throw new Error('STATIC_CONNECTOR_SUBCALL_CONFLICT');
      }
      return 1;
    }
    await repo.update(
      {
        id: toolCallId,
        status: ToolCallStatus.RUNNING,
        staticConnectorSubcallOrdinal: IsNull(),
      },
      {
        staticConnectorSubcallOrdinal: 1,
        staticConnectorRequestDigest: requestDigest,
      },
    );
    const persisted = await repo.findOne({ where: { id: toolCallId } });
    if (
      !persisted ||
      persisted.staticConnectorSubcallOrdinal !== 1 ||
      persisted.staticConnectorRequestDigest !== requestDigest
    ) {
      throw new Error('STATIC_CONNECTOR_SUBCALL_CONFLICT');
    }
    return 1;
  }

  /**
   * Re-enter an executable-v2 L3 call without inserting another ToolCall.
   * The persisted row, canonical raw-input digest and immutable release/tool
   * tuple must all byte-match the server-owned approval grant.
   */
  async resumeApproved(
    input: ToolCallResumeApprovedInput,
    manager?: EntityManager,
  ): Promise<ToolCallRecord> {
    const {
      toolCallId,
      inputDigest,
      releaseSetId,
      publishedChecksum,
    } = input.grant;
    if (
      input.grant.toolName !== input.toolName ||
      !input.grant.approvalInstanceId ||
      !toolCallId ||
      !inputDigest ||
      !releaseSetId ||
      !publishedChecksum
    ) {
      throw new Error('TOOL_APPROVAL_GRANT_INVALID');
    }
    const expectedInputDigest = buildPreview(
      input.input,
      input.resolvedTool.exportDescriptor,
      'input',
    ).digest;
    if (
      expectedInputDigest !== inputDigest ||
      releaseSetId !== input.context.release.releaseSetId ||
      publishedChecksum !== input.resolvedTool.publishedChecksum
    ) {
      throw new Error('TOOL_APPROVAL_GRANT_MISMATCH');
    }

    const record = await this.repo(manager).findOne({
      where: {
        id: toolCallId,
        workspaceId: input.context.release.executionWorkspaceId,
        status: In([
          ToolCallStatus.REQUIRES_APPROVAL,
          ToolCallStatus.RUNNING,
        ]),
      },
    });
    if (!record) {
      throw new Error('TOOL_APPROVAL_TOOL_CALL_NOT_FOUND');
    }
    if (
      record.toolName !== input.toolName ||
      record.inputDigest !== inputDigest ||
      record.sourceWorkspaceId !== input.context.release.sourceWorkspaceId ||
      record.releaseSetId !== releaseSetId ||
      record.functionRevisionId !== input.resolvedTool.functionRevisionId ||
      record.descriptorHash !== input.resolvedTool.descriptorHash ||
      record.publishedChecksum !== publishedChecksum ||
      record.runtimeProviderId !== input.resolvedTool.runtimeProviderId
    ) {
      throw new Error('TOOL_APPROVAL_TOOL_CALL_MISMATCH');
    }
    return record;
  }

  async resumeApprovedStatic(
    input: StaticToolCallResumeApprovedInput,
    manager?: EntityManager,
  ): Promise<ToolCallRecord> {
    const { toolCallId, inputDigest } = input.grant;
    if (
      input.grant.toolName !== input.toolName ||
      !input.grant.approvalInstanceId ||
      !toolCallId ||
      !inputDigest
    ) {
      throw new Error('TOOL_APPROVAL_GRANT_INVALID');
    }
    const expectedInputDigest = buildPreview(
      input.input,
      undefined,
      'input',
    ).digest;
    if (expectedInputDigest !== inputDigest) {
      throw new Error('TOOL_APPROVAL_GRANT_MISMATCH');
    }
    const record = await this.repo(manager).findOne({
      where: {
        id: toolCallId,
        workspaceId: input.context.workspaceId,
        toolName: input.toolName,
        status: In([
          ToolCallStatus.REQUIRES_APPROVAL,
          ToolCallStatus.RUNNING,
        ]),
      },
    });
    if (
      !record ||
      record.inputDigest !== inputDigest ||
      !record.staticBindingRevisionId ||
      !record.staticBindingChecksum ||
      !record.staticBindingGeneration
    ) {
      throw new Error('TOOL_APPROVAL_TOOL_CALL_MISMATCH');
    }
    return record;
  }

  async markRunning(
    id: string,
    timeoutMs: number,
    manager?: EntityManager,
    expected: readonly ToolCallStatus[] = [ToolCallStatus.STARTED],
  ): Promise<void> {
    const now = new Date();
    await this.transition(
      id,
      expected,
      ToolCallStatus.RUNNING,
      {
        lastHeartbeatAt: now,
        leaseExpiresAt: new Date(
          now.getTime() + Math.max(1, timeoutMs),
        ),
        permissionCheck: 'passed',
        guardrailCheck: 'passed',
      },
      manager,
    );
  }

  /**
   * Host/worker liveness proof. The persisted lease is the hard execution
   * deadline established by markRunning (or begin for pre-gate STARTED
   * recovery); a heartbeat may refresh liveness only while that lease is
   * still valid and never moves the deadline.
   */
  async heartbeat(
    id: string,
    manager?: EntityManager,
  ): Promise<void> {
    const now = new Date();
    const result = await this.repo(manager).update(
      {
        id,
        status: ToolCallStatus.RUNNING,
        leaseExpiresAt: MoreThan(now),
      },
      { lastHeartbeatAt: now },
    );
    if (result.affected !== 1) {
      throw new Error(`TOOL_CALL_HEARTBEAT_REJECTED:${id}`);
    }
  }

  async finalize(
    id: string,
    input: ToolCallFinalizeInput,
    descriptor?: Readonly<AgentCodeToolExportV1>,
    manager?: EntityManager,
  ): Promise<void> {
    const preview =
      input.output === undefined
        ? null
        : buildPreview(input.output, descriptor, 'output');
    await this.transition(
      id,
      [ToolCallStatus.STARTED, ToolCallStatus.RUNNING],
      input.status,
      {
        ...(preview
          ? { outputDigest: preview.digest, output: preview.value }
          : { outputDigest: null, output: null }),
        permissionCheck: input.permissionCheck,
        permissionDetail: input.permissionDetail ?? null,
        guardrailCheck: input.guardrailCheck,
        durationMs: input.durationMs,
        errorCode: input.errorCode ?? null,
        leaseExpiresAt: null,
      } as any,
      manager,
    );
  }

  private repo(manager?: EntityManager): Repository<ToolCallRecord> {
    return manager?.getRepository(ToolCallRecord) ?? this.records;
  }

  private assertStaticBindingSnapshot(
    record: ToolCallRecord,
    input: StaticConnectorBindingSnapshotV1,
  ): void {
    if (
      record.staticBindingRevisionId !== input.revisionId ||
      record.staticBindingChecksum !== input.checksum ||
      String(record.staticBindingGeneration) !== input.generation
    ) {
      throw new Error('STATIC_CONNECTOR_BINDING_SNAPSHOT_CONFLICT');
    }
  }
}

function buildPreview(
  raw: unknown,
  descriptor: Readonly<AgentCodeToolExportV1> | undefined,
  direction: 'input' | 'output',
): { digest: `sha256:${string}`; value: Record<string, unknown> } {
  if (!isJsonValue(raw)) {
    throw new Error(`TOOL_CALL_${direction.toUpperCase()}_NOT_JSON`);
  }
  const digest = canonicalJsonDigest(raw);
  if (descriptor?.redaction?.logPolicy === 'metadata_only') {
    return {
      digest,
      value: { redacted: true, digest },
    };
  }
  const pointers =
    direction === 'input'
      ? descriptor?.redaction?.inputJsonPointers ?? []
      : descriptor?.redaction?.outputJsonPointers ?? [];
  const pointerRedacted = applyJsonRedactionPointers(
    raw,
    pointers,
    'TOOL_CALL_REDACTION_POINTER_INVALID',
  );
  const scrubbed = redactSensitivePayload(pointerRedacted, {
    sensitiveKeyMode: 'drop',
  });
  if (!isJsonValue(scrubbed)) {
    throw new Error('TOOL_CALL_REDACTION_INVALID');
  }
  const wrapped: JsonValue =
    scrubbed && typeof scrubbed === 'object' && !Array.isArray(scrubbed)
      ? scrubbed
      : { value: scrubbed };
  const canonical = canonicalJsonString(wrapped);
  if (Buffer.byteLength(canonical, 'utf8') > MAX_PREVIEW_BYTES) {
    return {
      digest,
      value: { redacted: true, truncated: true, digest },
    };
  }
  return {
    digest,
    value: JSON.parse(canonical) as Record<string, unknown>,
  };
}

function isGovernedContext(
  context: AgentExecutionContext | GovernedToolExecutionContextV1,
): context is GovernedToolExecutionContextV1 {
  return (
    'release' in context &&
    'principal' in context &&
    'parent' in context
  );
}

function isLegacyContext(
  context: AgentExecutionContext | GovernedToolExecutionContextV1,
): context is AgentExecutionContext {
  return 'executionId' in context && 'workspaceId' in context;
}
