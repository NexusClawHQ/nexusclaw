import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Ajv from 'ajv';
import type { ResolvedAgentExecutableToolV1 } from '@nexusclaw/shared/agent-executable-assets';
import {
  ToolCallRecord,
  ToolCallStatus,
} from '../entities/tool-call-record.entity';
import {
  AgentTool,
  AgentToolProvider,
  ToolCallResult,
  AgentExecutionContext,
  GovernedToolExecutionContextV1,
  TOOL_APPROVAL_SUBJECT_PORT,
  type ToolApprovalSubjectPort,
} from '../interfaces';
import { AuditLoggerService } from '../../guardrail/services/audit-logger.service';
import { StructuredLogger } from '../../../common/logging';
import type { ContextualAgentToolProvider } from './contextual-agent-tool-provider';
import { supportsContextualExecution } from './contextual-agent-tool-provider';
import { ToolCallLifecycleService } from './tool-call-lifecycle.service';
import { generateId } from '../../../common/utils/generate-id';
import { deriveCodeActionLifecycleLeaseMs } from './code-action-runtime-budget';

/**
 * Tool Registry Service
 *
 * Manages Agent tool registration, input validation,
 * permission checks, risk assessment, execution, and record persistence.
 */
@Injectable()
export class ToolRegistryService implements OnApplicationBootstrap {
  private readonly logger = new StructuredLogger(ToolRegistryService.name);
  private readonly schemaValidator = new Ajv({ allErrors: true, strict: false });
  private readonly tools = new Map<string, AgentTool>();
  private readonly contextualProviders =
    new Map<string, ContextualAgentToolProvider>();
  private contextualRegistrationSealed = false;

  constructor(
    @InjectRepository(ToolCallRecord)
    _legacyToolCallRepo: Repository<ToolCallRecord>,
    private readonly auditLogger: AuditLoggerService,
    @Optional()
    private readonly toolCalls?: ToolCallLifecycleService,
    @Optional()
    @Inject(TOOL_APPROVAL_SUBJECT_PORT)
    private readonly approvalSubjects?: ToolApprovalSubjectPort,
  ) {}

  /**
   * Register a tool in the registry.
   */
  registerTool(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    this.logger.log({
      event: 'agent_runtime.tool_registry.registered',
      toolName: tool.name,
      category: tool.category,
      riskLevel: tool.riskLevel,
    });
  }

  /**
   * Register all tools declared by a provider (declarative extension point).
   */
  registerProvider(provider: AgentToolProvider): void {
    const tools = provider.buildTools();
    for (const tool of tools) this.registerTool(tool);
    this.logger.log({
      event: 'agent_runtime.tool_registry.provider_registered',
      providerKey: provider.providerKey,
      toolCount: tools.length,
    });
  }

  /**
   * Register one release-aware provider during startup only.
   *
   * Provider keys and declared tool names are deterministic bootstrap
   * contracts. Dynamic names are also collision-checked on every contextual
   * resolution so a release cannot shadow a static tool after startup.
   */
  registerContextualProvider(
    providerKey: string,
    provider: ContextualAgentToolProvider,
  ): void {
    const normalizedKey = providerKey.trim();
    if (this.contextualRegistrationSealed) {
      throw new Error('TOOL_CONTEXTUAL_PROVIDER_REGISTRY_SEALED');
    }
    if (!normalizedKey || normalizedKey !== provider.providerKey) {
      throw new Error('TOOL_CONTEXTUAL_PROVIDER_KEY_INVALID');
    }
    if (this.contextualProviders.has(normalizedKey)) {
      throw new Error('TOOL_CONTEXTUAL_PROVIDER_DUPLICATE');
    }
    const declaredNames = [...(provider.declaredToolNames ?? [])];
    if (
      declaredNames.some((name) => !name || name.trim() !== name) ||
      new Set(declaredNames).size !== declaredNames.length
    ) {
      throw new Error('TOOL_CONTEXTUAL_PROVIDER_DECLARATIONS_INVALID');
    }
    const collision = declaredNames.find((name) => this.tools.has(name));
    if (collision) {
      throw new Error(`TOOL_STATIC_CONTEXTUAL_NAME_COLLISION:${collision}`);
    }
    this.contextualProviders.set(normalizedKey, provider);
  }

  onApplicationBootstrap(): void {
    this.contextualRegistrationSealed = true;
  }

  /**
   * Get a tool by name.
   */
  getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools available in the given execution context.
   */
  getAvailableTools(context: AgentExecutionContext): AgentTool[] {
    const allowed = context.constraints.allowedTools;
    return Array.from(this.tools.values()).filter((t) => allowed.includes(t.name));
  }
  /**
   * List all registered tools.
   */
  listTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Sole release-aware single-tool read. Legacy contexts remain static-only.
   */
  async resolveTool(
    name: string,
    context: AgentExecutionContext | GovernedToolExecutionContextV1,
  ): Promise<AgentTool | ResolvedAgentExecutableToolV1 | null> {
    const staticTool = this.tools.get(name) ?? null;
    if (!this.isGovernedContext(context)) return staticTool;

    const matches: ResolvedAgentExecutableToolV1[] = [];
    for (const provider of this.contextualProviders.values()) {
      const resolved = await provider.resolveTool(name, context);
      if (resolved) matches.push(resolved);
    }
    if (matches.length > 1) {
      throw new Error(`TOOL_CONTEXTUAL_NAME_COLLISION:${name}`);
    }
    if (staticTool && matches.length > 0) {
      throw new Error(`TOOL_STATIC_CONTEXTUAL_NAME_COLLISION:${name}`);
    }
    return staticTool ?? matches[0] ?? null;
  }

  /**
   * Sole release-aware catalogue read. Duplicate contextual names and any
   * static/dynamic collision are hard invariant failures, never first-wins.
   */
  async resolveAvailableTools(
    context: AgentExecutionContext | GovernedToolExecutionContextV1,
  ): Promise<Array<AgentTool | ResolvedAgentExecutableToolV1>> {
    const allowed = new Set(context.constraints.allowedTools);
    const staticTools = Array.from(this.tools.values()).filter((tool) =>
      allowed.has(tool.name),
    );
    if (!this.isGovernedContext(context)) return staticTools;

    const contextual: ResolvedAgentExecutableToolV1[] = [];
    const seen = new Set<string>();
    for (const provider of this.contextualProviders.values()) {
      for (const resolved of await provider.resolveAvailableTools(context)) {
        const name = resolved.exportDescriptor.toolName;
        if (this.tools.has(name)) {
          throw new Error(`TOOL_STATIC_CONTEXTUAL_NAME_COLLISION:${name}`);
        }
        if (seen.has(name)) {
          throw new Error(`TOOL_CONTEXTUAL_NAME_COLLISION:${name}`);
        }
        seen.add(name);
        if (allowed.has(name)) contextual.push(resolved);
      }
    }
    return [...staticTools, ...contextual].sort((left, right) =>
      this.resolvedName(left).localeCompare(this.resolvedName(right)),
    );
  }

  /**
   * Execute a tool with full pipeline:
   * input validation → permission check → risk assessment → execute → persist record.
   */
  async executeTool(
    toolName: string,
    input: unknown,
    context: AgentExecutionContext | GovernedToolExecutionContextV1,
    options?: Readonly<{ requireDurableL3Approval?: boolean }>,
  ): Promise<ToolCallResult> {
    const resolved = await this.resolveTool(toolName, context);
    if (!resolved) {
      return this.failResult(`Tool not found: ${toolName}`, 'denied', 'blocked', 0);
    }
    const dynamic = !this.isStaticTool(resolved);
    if (
      options?.requireDurableL3Approval &&
      (
        !dynamic ||
        !this.isGovernedContext(context) ||
        resolved.exportDescriptor.declaredRiskLevel !== 'L3'
      )
    ) {
      return this.failResult(
        'GOVERNED_SENSITIVE_APPROVAL_DESCRIPTOR_MISMATCH',
        'denied',
        'blocked',
        0,
      );
    }
    if (!this.isStaticTool(resolved) && !this.isGovernedContext(context)) {
      return this.failResult(
        'Contextual tool requires a governed execution snapshot',
        'denied',
        'blocked',
        0,
      );
    }
    if (this.isStaticTool(resolved) && !this.isLegacyExecutionContext(context)) {
      return this.failResult(
        'Static tool requires the persisted runtime security context',
        'denied',
        'blocked',
        0,
      );
    }
    // Provider prompts and older package assets occasionally emit an API name
    // with case-only drift (for example opportunityLineItem vs
    // OpportunityLineItem). Resolve only against the role's already-authorized
    // object set, then carry that canonical value through lifecycle, audit,
    // permission, FLS/sharing, and execution. Unknown/ambiguous names are left
    // untouched so the normal permission gate fails closed.
    if (this.isLegacyExecutionContext(context)) {
      input = await this.canonicalizeAuthorizedObjectApiName(input, context);
    }
    if (
      this.isStaticTool(resolved) &&
      this.isLegacyExecutionContext(context) &&
      (
        toolName === 'slack.message.send' ||
        toolName === 'teams.message.send'
      ) &&
      resolved.riskLevel === 'L3' &&
      context.approvalGrant?.toolName !== toolName &&
      context.constraints.allowedTools.includes(toolName) &&
      !resolved.requiredPermissions.objectApiName &&
      !resolved.requiredPermissions.operation
    ) {
      const requiredFields = (
        resolved.inputSchema as { required?: string[] } | undefined
      )?.required ?? [];
      const inputObject =
        input && typeof input === 'object'
          ? input as Record<string, unknown>
          : null;
      const inputValid =
        inputObject !== null &&
        requiredFields.every((field) => inputObject[field] !== undefined);
      if (inputValid) {
        if (!resolved.prepareApproval || !this.approvalSubjects) {
          return this.failResult(
            'TOOL_APPROVAL_SUBJECT_OWNER_UNAVAILABLE',
            'passed',
            'blocked',
            0,
          );
        }
        const lifecycle = this.requireToolCallLifecycle();
        const toolCallId = generateId();
        const inputDigest = lifecycle.deriveInputDigest(input);
        const preparation = await resolved.prepareApproval(input, context, {
          toolCallId,
          inputDigest,
        });
        const approval =
          await this.approvalSubjects.submitStaticToolSubject({
            toolName,
            rawInput: input,
            context,
            preparation,
          });
        await this.logGovernanceEvent({
          context,
          tool: resolved,
          toolName,
          input,
          governanceCategory: 'approval_degradation',
          riskLevel: resolved.riskLevel,
          actionTaken: 'approve',
          approvalStatus: 'pending',
          reason: 'L3 operation requires durable approval',
        });
        return {
          success: false,
          output: null,
          error: 'L3 operation requires approval',
          permissionCheck: 'passed',
          guardrailCheck: 'escalated',
          duration: 0,
          status: 'requires_approval',
          toolName,
          ...approval,
        };
      }
    }

    if (
      dynamic &&
      this.isGovernedContext(context) &&
      (
        resolved.exportDescriptor.declaredRiskLevel === 'L3' ||
        options?.requireDurableL3Approval === true
      ) &&
      context.approvalGrant?.toolName !== toolName &&
      context.constraints.allowedTools.includes(toolName)
    ) {
      if (!this.approvalSubjects) {
        return this.failResult(
          'TOOL_APPROVAL_SUBJECT_OWNER_UNAVAILABLE',
          'passed',
          'blocked',
          0,
        );
      }
      const approval = await this.approvalSubjects.submitToolSubject({
        toolName,
        rawInput: input,
        resolvedTool: resolved,
        context,
      });
      return {
        success: false,
        output: null,
        error: 'L3 operation requires approval',
        permissionCheck: 'passed',
        guardrailCheck: 'escalated',
        duration: 0,
        status: 'requires_approval',
        ...approval,
      };
    }

    const lifecycle = this.requireToolCallLifecycle();
    let approvedResume = false;
    let call: ToolCallRecord;
    if (
      dynamic &&
      this.isGovernedContext(context) &&
      context.approvalGrant?.toolName === toolName
    ) {
      call = await lifecycle.resumeApproved({
        toolName,
        input,
        context,
        resolvedTool: resolved,
        grant: context.approvalGrant,
      });
      approvedResume = true;
    } else if (
      !dynamic &&
      this.isLegacyExecutionContext(context) &&
      context.approvalGrant?.toolName === toolName &&
      context.approvalGrant.toolCallId
    ) {
      call = await lifecycle.resumeApprovedStatic({
        toolName: toolName as
          | 'slack.message.send'
          | 'teams.message.send',
        input,
        context,
        grant: context.approvalGrant,
      });
      approvedResume = true;
    } else {
      call = await lifecycle.begin({
        toolName,
        toolCategory: dynamic ? 'internal' : resolved.category,
        input,
        context,
        ...(dynamic ? { resolvedTool: resolved } : {}),
      });
    }

    // Step 1: Check if tool is allowed
    if (!context.constraints.allowedTools.includes(toolName)) {
      if (
        this.isStaticTool(resolved) &&
        this.isLegacyExecutionContext(context)
      ) {
        await this.logGovernanceEvent({
          context,
          tool: resolved,
          toolName,
          input,
          governanceCategory: 'runtime_permission_denied',
          riskLevel: 'L4',
          actionTaken: 'block',
          reason: 'Tool not allowed',
        });
      }
      await lifecycle.transition(
        call.id,
        this.openCallStatuses(call),
        ToolCallStatus.DENIED,
        {
          permissionCheck: 'denied',
          guardrailCheck: 'blocked',
          errorCode: 'TOOL_NOT_ALLOWED',
        },
      );
      return {
        ...this.failResult(
          'Tool not allowed',
          'denied',
          'blocked',
          0,
        ),
        toolCallId: call.id,
      };
    }

    if (!this.isStaticTool(resolved)) {
      if (!this.isGovernedContext(context)) {
        throw new Error('TOOL_CONTEXT_INVARIANT_VIOLATION');
      }
      return this.executeContextualTool(
        resolved,
        input,
        context,
        call,
        lifecycle,
        approvedResume,
      );
    }
    if (!this.isLegacyExecutionContext(context)) {
      throw new Error('TOOL_CONTEXT_INVARIANT_VIOLATION');
    }
    const tool = resolved;

    // Step 2: validate the exact schema rendered into the planner prompt.
    // Invented enum values and fields stop here, before permission,
    // guardrail, or executable runtime dispatch.
    if (tool.inputSchema) {
      const validate = this.schemaValidator.compile(tool.inputSchema as object);
      if (!validate(input)) {
        await lifecycle.finalize(call.id, {
          status: ToolCallStatus.FAILED,
          permissionCheck: 'passed',
          guardrailCheck: 'passed',
          durationMs: 0,
          errorCode: 'TOOL_INPUT_SCHEMA_INVALID',
        });
        const schemaError = validate.errors?.[0];
        return {
          ...this.failResult(
            `Tool input schema validation failed: ${schemaError?.instancePath || '/'} ${schemaError?.message || 'invalid input'}`,
            'passed',
            'passed',
            0,
          ),
          toolCallId: call.id,
        };
      }
    }

    // Step 3: Permission check
    const operation = tool.requiredPermissions.operation as
      | 'read'
      | 'create'
      | 'update'
      | 'delete'
      | undefined;
    const resolvedObjectApiName =
      tool.requiredPermissions.objectApiName ||
      (typeof input === 'object' && input !== null
        ? ((input as any).objectApiName as string | undefined)
        : undefined);

    if (operation && resolvedObjectApiName) {
      const exactObjectPermission = context.security.objectPermissions.find(
        (p) => p.objectApiName === resolvedObjectApiName,
      );
      const foldedObjectPermissions = exactObjectPermission
        ? []
        : context.security.objectPermissions.filter(
            (p) => p.objectApiName.toLocaleLowerCase('en-US') ===
              resolvedObjectApiName.toLocaleLowerCase('en-US'),
          );
      const objPerm =
        exactObjectPermission ??
        (foldedObjectPermissions.length === 1
          ? foldedObjectPermissions[0]
          : undefined);
      if (!objPerm) {
        await this.logGovernanceEvent({
          context,
          tool,
          toolName,
          input,
          governanceCategory: 'runtime_permission_denied',
          riskLevel: 'L4',
          actionTaken: 'block',
          reason: `No permission for object ${resolvedObjectApiName}`,
          operation,
          objectApiName: resolvedObjectApiName,
        });
        await lifecycle.transition(
          call.id,
          [ToolCallStatus.STARTED],
          ToolCallStatus.DENIED,
          {
            permissionCheck: 'denied',
            guardrailCheck: 'blocked',
            errorCode: 'OBJECT_PERMISSION_MISSING',
          },
        );
        return {
          ...this.failResult(
            `No permission for object ${resolvedObjectApiName}`,
            'denied',
            'blocked',
            0,
          ),
          toolCallId: call.id,
        };
      }

      const hasAccess =
        (operation === 'read' && objPerm.canRead) ||
        (operation === 'create' && objPerm.canCreate) ||
        (operation === 'update' && objPerm.canUpdate) ||
        (operation === 'delete' && objPerm.canDelete);

      if (!hasAccess) {
        await this.logGovernanceEvent({
          context,
          tool,
          toolName,
          input,
          governanceCategory: 'runtime_permission_denied',
          riskLevel: 'L4',
          actionTaken: 'block',
          reason: `No ${operation} permission on ${resolvedObjectApiName}`,
          operation,
          objectApiName: resolvedObjectApiName,
        });
        await lifecycle.transition(
          call.id,
          [ToolCallStatus.STARTED],
          ToolCallStatus.DENIED,
          {
            permissionCheck: 'denied',
            guardrailCheck: 'blocked',
            errorCode: 'OBJECT_OPERATION_DENIED',
          },
        );
        return {
          ...this.failResult(
            `No ${operation} permission on ${resolvedObjectApiName}`,
            'denied',
            'blocked',
            0,
          ),
          toolCallId: call.id,
        };
      }
    }

    // Step 4: Risk level / Guardrail check
    const riskNum = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 }[tool.riskLevel] || 0;

    if (riskNum >= 4) {
      await this.logGovernanceEvent({
        context,
        tool,
        toolName,
        input,
        governanceCategory: 'guardrail_blocked',
        riskLevel: tool.riskLevel,
        actionTaken: 'block',
        reason: 'L4 operation blocked - requires human',
        operation,
        objectApiName: resolvedObjectApiName,
      });
      await lifecycle.transition(
        call.id,
        [ToolCallStatus.STARTED],
        ToolCallStatus.BLOCKED,
        {
          permissionCheck: 'passed',
          guardrailCheck: 'blocked',
          errorCode: 'TOOL_RISK_L4_BLOCKED',
        },
      );
      return {
        ...this.failResult(
          'L4 operation blocked - requires human',
          'passed',
          'blocked',
          0,
        ),
        toolCallId: call.id,
      };
    }

    // A one-shot approval grant lets the single approved tool call
    // pass the L3 escalation gate (L4 block and permission checks above are
    // never exempted; design.md §6.4 / D5).
    const grant = context.approvalGrant;
    if (riskNum >= 3 && grant?.toolName === toolName) {
      await this.logGovernanceEvent({
        context,
        tool,
        toolName,
        input,
        governanceCategory: 'approval_degradation',
        riskLevel: tool.riskLevel,
        actionTaken: 'allow',
        reason: `approved via ${grant.approvalInstanceId}`,
        operation,
        objectApiName: resolvedObjectApiName,
      });
    } else if (riskNum >= 3) {
      let approvalPreparation;
      if (tool.prepareApproval) {
        approvalPreparation = await tool.prepareApproval(input, context, {
          toolCallId: call.id,
          inputDigest: call.inputDigest!,
        });
      }
      await this.logGovernanceEvent({
        context,
        tool,
        toolName,
        input,
        governanceCategory: 'approval_degradation',
        riskLevel: tool.riskLevel,
        actionTaken: 'approve',
        approvalStatus: 'pending',
        reason: 'L3 operation requires approval',
        operation,
        objectApiName: resolvedObjectApiName,
      });
      await lifecycle.transition(
        call.id,
        [ToolCallStatus.STARTED],
        ToolCallStatus.REQUIRES_APPROVAL,
        {
          permissionCheck: 'passed',
          guardrailCheck: 'escalated',
          errorCode: 'TOOL_APPROVAL_REQUIRED',
          leaseExpiresAt: null,
          lastHeartbeatAt: null,
        },
      );
      return {
        success: false,
        output: null,
        error: 'L3 operation requires approval',
        permissionCheck: 'passed',
        guardrailCheck: 'escalated',
        duration: 0,
        toolCallId: call.id,
        status: 'requires_approval',
        toolName,
        inputDigest: call.inputDigest ?? undefined,
        riskLevel: tool.riskLevel,
        ...(approvalPreparation ? { approvalPreparation } : {}),
      };
    }

    // Step 5: Execute tool
    const startTime = Date.now();
    if (call.status !== ToolCallStatus.RUNNING) {
      await lifecycle.markRunning(
        call.id,
        context.constraints.timeoutMs,
        undefined,
        approvedResume
          ? [ToolCallStatus.REQUIRES_APPROVAL]
          : [ToolCallStatus.STARTED],
      );
    }
    try {
      const result = await tool.execute(input, context, {
        toolCallId: call.id,
        inputDigest: call.inputDigest!,
      });
      const duration = Date.now() - startTime;
      await lifecycle.finalize(call.id, {
        status: result.success
          ? ToolCallStatus.SUCCEEDED
          : ToolCallStatus.FAILED,
        output: result.output,
        permissionCheck: result.permissionCheck,
        permissionDetail: result.permissionDetail,
        guardrailCheck: result.guardrailCheck,
        durationMs: duration,
        ...(!result.success ? { errorCode: 'TOOL_EXECUTION_FAILED' } : {}),
      });
      // Return the tool's own ToolCallResult directly (no double-wrapping)
      return { ...result, duration, toolCallId: call.id };
    } catch (error) {
      const duration = Date.now() - startTime;
      await lifecycle.finalize(call.id, {
        status: ToolCallStatus.FAILED,
        permissionCheck: 'passed',
        guardrailCheck: 'passed',
        durationMs: duration,
        errorCode: 'TOOL_EXECUTION_THROWN',
      });
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        permissionCheck: 'passed',
        guardrailCheck: 'passed',
        duration,
        toolCallId: call.id,
      };
    }
  }

  private async canonicalizeAuthorizedObjectApiName(
    input: unknown,
    context: AgentExecutionContext,
  ): Promise<unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return input;
    }
    const objectApiName = (input as Record<string, unknown>).objectApiName;
    if (typeof objectApiName !== 'string' || objectApiName.length === 0) {
      return input;
    }
    if (!/^[A-Za-z0-9_]+$/.test(objectApiName)) {
      return input;
    }
    const foldedName = objectApiName.toLocaleLowerCase('en-US');
    const matches = context.security.objectPermissions.filter(
      (permission) =>
        permission.objectApiName.toLocaleLowerCase('en-US') === foldedName,
    );
    if (matches.length !== 1) return input;

    // A unique folded permission match proves authorization but does not make
    // the permission snapshot's display casing an execution identity. Keep the
    // caller's already-authorized apiName unchanged so ReactStep, ToolCall and
    // the record owner observe one value. Record storage is resolved by stable
    // objectMetadataId rather than by this casing-sensitive string.
    return input;
  }

  private async executeContextualTool(
    tool: ResolvedAgentExecutableToolV1,
    input: unknown,
    context: GovernedToolExecutionContextV1,
    call: ToolCallRecord,
    lifecycle: ToolCallLifecycleService,
    approvedResume: boolean,
  ): Promise<ToolCallResult> {
    const riskLevel = tool.exportDescriptor.declaredRiskLevel;
    const riskNum = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 }[
      riskLevel
    ];
    if (riskNum >= 4) {
      await lifecycle.transition(
        call.id,
        this.openCallStatuses(call),
        ToolCallStatus.BLOCKED,
        {
          permissionCheck: 'passed',
          guardrailCheck: 'blocked',
          errorCode: 'TOOL_RISK_L4_BLOCKED',
        },
      );
      return {
        ...this.failResult(
          'L4 operation blocked - requires human',
          'passed',
          'blocked',
          0,
        ),
        toolCallId: call.id,
      };
    }
    if (riskNum >= 3 && !approvedResume) {
      await lifecycle.transition(
        call.id,
        this.openCallStatuses(call),
        ToolCallStatus.REQUIRES_APPROVAL,
        {
          permissionCheck: 'passed',
          guardrailCheck: 'escalated',
          errorCode: 'TOOL_APPROVAL_REQUIRED',
          leaseExpiresAt: null,
          lastHeartbeatAt: null,
        },
      );
      return {
        success: false,
        output: null,
        error: 'L3 operation requires approval',
        permissionCheck: 'passed',
        guardrailCheck: 'escalated',
        duration: 0,
        toolCallId: call.id,
        status: 'requires_approval',
        toolName: tool.exportDescriptor.toolName,
        inputDigest: call.inputDigest ?? undefined,
        releaseSetId: tool.releaseSetId,
        publishedChecksum: tool.publishedChecksum,
        riskLevel,
      };
    }

    const provider = this.contextualProviders.get('serverless-action');
    if (!provider || !supportsContextualExecution(provider)) {
      await lifecycle.transition(
        call.id,
        this.openCallStatuses(call),
        ToolCallStatus.BLOCKED,
        {
          permissionCheck: 'passed',
          guardrailCheck: 'blocked',
          errorCode: 'CODE_RUNTIME_ISOLATION_UNVERIFIED',
        },
      );
      return {
        ...this.failResult(
          'CODE_RUNTIME_ISOLATION_UNVERIFIED',
          'passed',
          'blocked',
          0,
        ),
        toolCallId: call.id,
      };
    }

    const startedAt = Date.now();
    if (call.status !== ToolCallStatus.RUNNING) {
      await lifecycle.markRunning(
        call.id,
        deriveCodeActionLifecycleLeaseMs(
          tool,
          context.constraints.timeoutMs,
        ),
        undefined,
        approvedResume
          ? [ToolCallStatus.REQUIRES_APPROVAL]
          : [ToolCallStatus.STARTED],
      );
    }
    try {
      const result = await provider.executeResolvedTool(
        tool,
        input,
        context,
        Object.freeze({ toolCallId: call.id, attempt: 0 as const }),
      );
      const duration = Date.now() - startedAt;
      if (result.completionCoordinated !== true) {
        await lifecycle.finalize(
          call.id,
          {
            status: result.success
              ? ToolCallStatus.SUCCEEDED
              : ToolCallStatus.FAILED,
            output: result.output,
            permissionCheck: result.permissionCheck,
            guardrailCheck: result.guardrailCheck,
            durationMs: duration,
            ...(!result.success
              ? { errorCode: 'CODE_ACTION_EXECUTION_FAILED' }
              : {}),
          },
          tool.exportDescriptor,
        );
      }
      return { ...result, duration, toolCallId: call.id };
    } catch (error) {
      const duration = Date.now() - startedAt;
      await lifecycle.finalize(
        call.id,
        {
          status: ToolCallStatus.FAILED,
          permissionCheck: 'passed',
          guardrailCheck: 'passed',
          durationMs: duration,
          errorCode: 'CODE_ACTION_EXECUTION_THROWN',
        },
        tool.exportDescriptor,
      );
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        permissionCheck: 'passed',
        guardrailCheck: 'passed',
        duration,
        toolCallId: call.id,
      };
    }
  }

  private isGovernedContext(
    context: AgentExecutionContext | GovernedToolExecutionContextV1,
  ): context is GovernedToolExecutionContextV1 {
    return (
      'release' in context &&
      'principal' in context &&
      'parent' in context
    );
  }

  private openCallStatuses(
    call: ToolCallRecord,
  ): readonly ToolCallStatus[] {
    return call.status === ToolCallStatus.REQUIRES_APPROVAL
      ? [ToolCallStatus.REQUIRES_APPROVAL]
      : [ToolCallStatus.STARTED];
  }

  private isLegacyExecutionContext(
    context: AgentExecutionContext | GovernedToolExecutionContextV1,
  ): context is AgentExecutionContext {
    return (
      'executionId' in context &&
      'workspaceId' in context &&
      'security' in context &&
      'business' in context &&
      'knowledge' in context
    );
  }

  private isStaticTool(
    tool: AgentTool | ResolvedAgentExecutableToolV1,
  ): tool is AgentTool {
    return 'execute' in tool;
  }

  private resolvedName(
    tool: AgentTool | ResolvedAgentExecutableToolV1,
  ): string {
    return this.isStaticTool(tool)
      ? tool.name
      : tool.exportDescriptor.toolName;
  }

  // --- Private helpers ---

  private failResult(
    error: string,
    permissionCheck: 'passed' | 'denied',
    guardrailCheck: 'passed' | 'escalated' | 'blocked',
    duration: number,
  ): ToolCallResult {
    return { success: false, output: null, error, permissionCheck, guardrailCheck, duration };
  }

  private requireToolCallLifecycle(): ToolCallLifecycleService {
    if (!this.toolCalls) {
      throw new Error('TOOL_CALL_LIFECYCLE_SERVICE_UNAVAILABLE');
    }
    return this.toolCalls;
  }

  private async logGovernanceEvent(params: {
    context: AgentExecutionContext;
    tool: AgentTool;
    toolName: string;
    input: unknown;
    governanceCategory:
      | 'runtime_permission_denied'
      | 'guardrail_blocked'
      | 'approval_degradation';
    riskLevel: string;
    actionTaken: 'block' | 'approve' | 'allow';
    reason: string;
    approvalStatus?: 'pending' | 'approved' | 'rejected' | 'timeout';
    operation?: string;
    objectApiName?: string;
  }): Promise<void> {
    await this.auditLogger.logGuardrailEvent({
      workspaceId: params.context.workspaceId,
      executionId: params.context.executionId,
      ruleName:
        params.governanceCategory === 'runtime_permission_denied'
          ? 'Runtime Permission Guard'
          : params.governanceCategory === 'guardrail_blocked'
            ? 'Runtime Guardrail Block'
            : 'Approval Degradation Gate',
      riskLevel: params.riskLevel,
      operationType: params.operation ?? params.toolName,
      objectApiName: params.objectApiName,
      actionTaken: params.actionTaken,
      approvalStatus: params.approvalStatus,
      context: {
        governanceCategory: params.governanceCategory,
        toolName: params.toolName,
        toolCategory: params.tool.category,
        reason: params.reason,
        traceId: params.context.traceId,
        correlationId: params.context.correlationId ?? params.context.traceId,
        actorType: params.context.actorType,
        actorId: params.context.actorId ?? params.context.triggeredBy,
        source: params.context.source,
        input: params.input,
      },
    });
  }
}
