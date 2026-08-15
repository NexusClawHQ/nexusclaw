/**
 * JSON Schema (Draft 2020-12) contract objects for the executable-workforce
 * surface, plus the frozen AJV configuration.
 *
 * Verbatim frozen constraints from design §9:
 * - dialect AJV Draft 2020-12, configured as below.
 * - every object explicitly sets `additionalProperties: false`.
 * - no remote refs, recursive refs, patternProperties, unevaluatedProperties,
 *   or custom executable formats; `$ref` targets must be inside `schemas/`.
 * - limits: schema file max 256 KiB; resolved schema depth max 12; total
 *   object properties max 256; enum values max 256; string pattern length max
 *   512. Runtime input/output max follows descriptor hard max 1 MiB.
 * - diagnostic path is RFC 6901 JSON Pointer; deterministic ordering
 *   `(file, jsonPath, ruleId, code)`.
 *
 * These schema objects are the shared truth consumed by CLI local validation,
 * backend preflight, and runtime input/output enforcement (R-04 rule 4).
 */
import type { AnySchemaObject } from 'ajv';

/**
 * The frozen AJV 8.18.0 configuration for Draft 2020-12 (design §9). All
 * settings are mandatory; toggling any is a contract change.
 */
export const FROZEN_AJV_CONFIG = {
  strict: true,
  strictSchema: true,
  allErrors: true,
  allowUnionTypes: false,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
  validateFormats: false,
  unicodeRegExp: true,
  messages: true,
  $data: false,
} as const;

/** Frozen schema-shape limits (design §9). */
export const SCHEMA_LIMITS = {
  schemaFileMaxBytes: 256 * 1024,
  resolvedDepthMax: 12,
  totalPropertiesMax: 256,
  enumValuesMax: 256,
  patternLengthMax: 512,
} as const;

/** Canonical decimal amount regex (design §6.2): `0|[1-9][0-9]*(\.[0-9]{1,9})?`. */
export const DECIMAL_MONEY_PATTERN = '^(0|[1-9][0-9]{0,17})(\\.[0-9]{1,9})?$';

/** Uppercase ISO-4217 currency. */
export const CURRENCY_PATTERN = '^[A-Z]{3}$';

/** Tool name `custom.<namespace>.<action>`. */
export const TOOL_NAME_PATTERN = '^custom\\.[a-z0-9-]+\\.[a-z0-9-]+$';

/** Lower-case `sha256:<64 hex>`. */
export const SHA256_PATTERN = '^sha256:[0-9a-f]{64}$';

/**
 * Root of an action input/output schema: must be `type: object` with
 * `additionalProperties: false` (R-04 rule 2). Use as a base to compose.
 */
export const actionIoSchemaRoot = (id: string): AnySchemaObject => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: id,
  type: 'object',
  additionalProperties: false,
  properties: {},
});

/**
 * `agent-code-tool/v1` export descriptor schema (design §6.2). Mirrors
 * {@link AgentCodeToolExportV1} exactly; every object is `additionalProperties:
 * false`.
 */
export const agentCodeToolExportSchema: AnySchemaObject = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'schema://nexusclaw/agent-code-tool/v1/export.schema.json',
  type: 'object',
  additionalProperties: false,
  required: [
    'contractVersion',
    'actionContractVersion',
    'exportId',
    'artifactRef',
    'toolName',
    'description',
    'inputSchemaRef',
    'outputSchemaRef',
    'sideEffectMode',
    'declaredRiskLevel',
    'capabilities',
    'limits',
    'redaction',
    'tests',
  ],
  properties: {
    contractVersion: { const: 'agent-code-tool/v1' },
    actionContractVersion: { const: 'nexus-code-action/v1' },
    exportId: { type: 'string', minLength: 1 },
    artifactRef: { type: 'string', minLength: 1 },
    toolName: { type: 'string', pattern: TOOL_NAME_PATTERN },
    description: { type: 'string', minLength: 1 },
    inputSchemaRef: { type: 'string', minLength: 1 },
    outputSchemaRef: { type: 'string', minLength: 1 },
    sideEffectMode: {
      enum: ['pure', 'read_only', 'idempotent_write', 'side_effecting'],
    },
    declaredRiskLevel: { enum: ['L0', 'L1', 'L2', 'L3', 'L4'] },
    capabilities: {
      type: 'object',
      additionalProperties: false,
      required: ['records', 'connectors', 'ai'],
      properties: {
        records: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['objectApiName', 'operations'],
            properties: {
              objectApiName: { type: 'string', minLength: 1 },
              operations: {
                type: 'array',
                items: { enum: ['read', 'create', 'update', 'delete'] },
              },
              readFields: { type: 'array', items: { type: 'string' } },
              writeFields: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        connectors: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['bindingKey', 'operations'],
            properties: {
              bindingKey: { type: 'string', minLength: 1 },
              operations: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        ai: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['policyKey', 'outputSchemaRef'],
            properties: {
              policyKey: { type: 'string', minLength: 1 },
              outputSchemaRef: { type: 'string', minLength: 1 },
            },
          },
        },
      },
    },
    limits: {
      type: 'object',
      additionalProperties: false,
      required: [
        'timeoutMs',
        'memoryMb',
        'maxQueries',
        'maxDmlStatements',
        'maxDmlRows',
        'maxCallouts',
        'maxAiCalls',
        'maxAiInputTokens',
        'maxAiOutputTokens',
        'maxAiCost',
        'maxLogEntries',
        'maxLogBytes',
        'maxAttempts',
      ],
      properties: {
        timeoutMs: { type: 'integer', minimum: 1 },
        memoryMb: { const: 128 },
        maxQueries: { type: 'integer', minimum: 0 },
        maxDmlStatements: { type: 'integer', minimum: 0 },
        maxDmlRows: { type: 'integer', minimum: 0 },
        maxCallouts: { type: 'integer', minimum: 0 },
        maxAiCalls: { type: 'integer', minimum: 0 },
        maxAiInputTokens: { type: 'integer', minimum: 0 },
        maxAiOutputTokens: { type: 'integer', minimum: 0 },
        maxAiCost: {
          type: 'object',
          additionalProperties: false,
          required: ['amount', 'currency'],
          properties: {
            amount: { type: 'string', pattern: DECIMAL_MONEY_PATTERN },
            currency: { type: 'string', pattern: CURRENCY_PATTERN },
          },
        },
        maxLogEntries: { type: 'integer', minimum: 0 },
        maxLogBytes: { type: 'integer', minimum: 0 },
        maxAttempts: { const: 1 },
      },
    },
    idempotency: {
      type: 'object',
      additionalProperties: false,
      required: ['inputJsonPointer', 'windowSeconds'],
      properties: {
        inputJsonPointer: { type: 'string', minLength: 1 },
        windowSeconds: { const: 86400 },
      },
    },
    redaction: {
      type: 'object',
      additionalProperties: false,
      required: ['inputJsonPointers', 'outputJsonPointers', 'logPolicy'],
      properties: {
        inputJsonPointers: { type: 'array', items: { type: 'string' } },
        outputJsonPointers: { type: 'array', items: { type: 'string' } },
        logPolicy: { enum: ['metadata_only', 'redacted_payload'] },
      },
    },
    tests: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'required'],
        properties: {
          path: { type: 'string', minLength: 1 },
          required: { const: true },
        },
      },
    },
  },
};

/** `nexusclaw.cli-result/v1` envelope schema (design §16.2 / R-17). */
export const cliResultSchema: AnySchemaObject = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'schema://nexusclaw/cli-result/v1.schema.json',
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'ok',
    'exitCode',
    'command',
    'phase',
    'contractVersion',
    'data',
    'diagnostics',
    'evidence',
    'nextCommands',
  ],
  properties: {
    schemaVersion: { const: 'nexusclaw.cli-result/v1' },
    ok: { type: 'boolean' },
    exitCode: { enum: [0, 1, 2, 3, 4, 5, 6, 64, 70] },
    command: { type: 'string', minLength: 1 },
    phase: { type: 'string', minLength: 1 },
    contractVersion: { type: 'string', minLength: 1 },
    // `data` is the command payload (any JSON value) or null; Draft 2020-12
    // expresses nullable-any without the `nullable` keyword.
    data: {},
    diagnostics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'severity', 'phase', 'message', 'retryable'],
        properties: {
          code: { type: 'string', minLength: 1 },
          severity: { enum: ['error', 'warning', 'info'] },
          phase: { type: 'string', minLength: 1 },
          artifactId: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer', minimum: 1 },
          column: { type: 'integer', minimum: 1 },
          jsonPath: { type: 'string' },
          ruleId: { type: 'string' },
          message: { type: 'string', minLength: 1 },
          fixHint: { type: 'string' },
          retryable: { type: 'boolean' },
          docsRef: { type: 'string' },
        },
      },
    },
    evidence: { type: 'array' },
    nextCommands: { type: 'array' },
  },
};

/**
 * Flow `payload/v2` INVOKE_UNIT action-setting schema fragment (design §15.2).
 * Rejects duplicate mapping targets and ancestor/descendant overlap; the
 * compiler enforces overlap statically, the schema enforces shape.
 */
export const flowInvokeUnitActionSettingSchema: AnySchemaObject = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'schema://nexusclaw/flows/payload-v2/invoke-unit.schema.json',
  type: 'object',
  additionalProperties: false,
  required: [
    'actionType',
    'unitId',
    'inputMappings',
    'outputVariableName',
    'onError',
  ],
  properties: {
    actionType: { const: 'INVOKE_UNIT' },
    unitId: { type: 'string', pattern: '^action:custom\\.[a-z0-9-]+\\.[a-z0-9-]+$' },
    inputMappings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['targetJsonPointer', 'source'],
        properties: {
          targetJsonPointer: {
            type: 'string',
            pattern: '^/(?:[^~]|~[01])+$',
          },
          source: {
            oneOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['kind', 'path'],
                properties: {
                  kind: { const: 'context_path' },
                  path: { type: 'string', minLength: 1 },
                },
              },
              {
                type: 'object',
                additionalProperties: false,
                required: ['kind', 'value'],
                properties: {
                  kind: { const: 'literal' },
                  value: {},
                },
              },
            ],
          },
        },
      },
    },
    outputVariableName: {
      type: 'string',
      pattern: '^[A-Za-z_][A-Za-z0-9_]*$',
    },
    onError: { enum: ['fail', 'fault_path'] },
    faultEdgeHandle: { const: 'fault' },
  },
  allOf: [
    {
      if: {
        properties: { onError: { const: 'fault_path' } },
        required: ['onError'],
      },
      then: {
        properties: { faultEdgeHandle: { const: 'fault' } },
        required: ['faultEdgeHandle'],
      },
      else: {
        not: {
          properties: { faultEdgeHandle: {} },
          required: ['faultEdgeHandle'],
        },
      },
    },
  ],
};

/**
 * Workforce bundle v1 schema fragment — identity field subset (design §5.1).
 * Full field validation lives in the bundle validator; this is the
 * machine-readable schema for the `agentApiName` identity contract.
 */
export const workforceBundleIdentitySchema: AnySchemaObject = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'schema://nexusclaw/ai-workforce-executable-bundle/v1/identity.schema.json',
  type: 'object',
  additionalProperties: true,
  required: ['schemaVersion', 'agentApiName', 'version', 'releasePolicy'],
  properties: {
    schemaVersion: { const: 'ai-workforce-executable-bundle/v1' },
    agentApiName: { type: 'string', minLength: 1 },
    version: { type: 'string', minLength: 1 },
    releasePolicy: {
      type: 'object',
      additionalProperties: false,
      required: [
        'requireCandidateTests',
        'requireRegressionBaseline',
        'requireHumanApproval',
        'workforceReleaseApprovalPolicyApiName',
        'defaultToolApprovalPolicyApiName',
        'minimumSimulationPassRate',
        'mutationPolicy',
      ],
      properties: {
        requireCandidateTests: { const: true },
        requireRegressionBaseline: { const: true },
        requireHumanApproval: { const: true },
        workforceReleaseApprovalPolicyApiName: { type: 'string', minLength: 1 },
        defaultToolApprovalPolicyApiName: { type: 'string', minLength: 1 },
        minimumSimulationPassRate: { const: 1 },
        mutationPolicy: { const: 'sandbox-only' },
      },
    },
  },
};

const fixtureErrorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'retryable'],
  properties: {
    code: { type: 'string', minLength: 1 },
    retryable: { type: 'boolean' },
  },
} as const;

const recordsFixtureCallSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['sequence', 'namespace', 'method', 'request'],
  properties: {
    sequence: { type: 'integer', minimum: 1 },
    namespace: { const: 'records' },
    method: { enum: ['get', 'query', 'create', 'update', 'delete'] },
    request: {},
    response: {},
    error: fixtureErrorSchema,
  },
  oneOf: [
    { required: ['response'], not: { required: ['error'] } },
    { required: ['error'], not: { required: ['response'] } },
  ],
} as const;

const connectorFixtureCallSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'sequence',
    'namespace',
    'method',
    'bindingKey',
    'operation',
    'request',
  ],
  properties: {
    sequence: { type: 'integer', minimum: 1 },
    namespace: { const: 'connectors' },
    method: { const: 'call' },
    bindingKey: { type: 'string', minLength: 1 },
    operation: { type: 'string', minLength: 1 },
    request: {},
    response: {},
    error: fixtureErrorSchema,
  },
  oneOf: [
    { required: ['response'], not: { required: ['error'] } },
    { required: ['error'], not: { required: ['response'] } },
  ],
} as const;

const aiFixtureCallSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['sequence', 'namespace', 'method', 'policyKey', 'request'],
  properties: {
    sequence: { type: 'integer', minimum: 1 },
    namespace: { const: 'ai' },
    method: { const: 'generate' },
    policyKey: { type: 'string', minLength: 1 },
    request: {},
    response: {},
    usage: {},
    error: fixtureErrorSchema,
  },
  oneOf: [
    {
      required: ['response', 'usage'],
      not: { required: ['error'] },
    },
    {
      required: ['error'],
      not: {
        anyOf: [{ required: ['response'] }, { required: ['usage'] }],
      },
    },
  ],
} as const;

/**
 * Declarative action-case fixture contract (design §19). This is the exact
 * schema shipped in AI authoring context packs; runtime readers must not
 * replace it with an anonymous `{ type: "object" }` fallback.
 */
export const codeActionCasesV1Schema: AnySchemaObject = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'schema://nexusclaw/code-action-cases/v1/schema.json',
  title: 'code-action-cases/v1',
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'actionExportId',
    'principalFixtures',
    'cases',
  ],
  properties: {
    schemaVersion: { const: 'code-action-cases/v1' },
    actionExportId: { type: 'string', minLength: 1 },
    principalFixtures: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fixtureId', 'base'],
        properties: {
          fixtureId: { type: 'string', minLength: 1 },
          base: { const: 'bound_candidate_agent' },
          restrictTo: {
            type: 'object',
            additionalProperties: false,
            required: ['objectApiName'],
            properties: {
              objectApiName: { type: 'string', minLength: 1 },
              operations: {
                type: 'array',
                minItems: 1,
                uniqueItems: true,
                items: { enum: ['read', 'create', 'update', 'delete'] },
              },
              hiddenFields: {
                type: 'array',
                uniqueItems: true,
                items: { type: 'string', minLength: 1 },
              },
              readonlyFields: {
                type: 'array',
                uniqueItems: true,
                items: { type: 'string', minLength: 1 },
              },
              dataScope: {
                oneOf: [
                  {
                    type: 'object',
                    additionalProperties: false,
                    required: ['type'],
                    properties: { type: { const: 'own' } },
                  },
                  {
                    type: 'object',
                    additionalProperties: false,
                    required: ['type', 'orgNodeId', 'orgSubtreeIds'],
                    properties: {
                      type: { const: 'org_subtree' },
                      orgNodeId: { type: 'string', minLength: 1 },
                      orgSubtreeIds: {
                        type: 'array',
                        minItems: 1,
                        uniqueItems: true,
                        items: { type: 'string', minLength: 1 },
                      },
                    },
                  },
                  {
                    type: 'object',
                    additionalProperties: false,
                    required: ['type', 'customFilter'],
                    properties: {
                      type: { const: 'custom' },
                      customFilter: { type: 'string', minLength: 1 },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
    cases: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'caseId',
          'input',
          'principalFixtureId',
          'clock',
          'hostFixtures',
          'expect',
        ],
        properties: {
          caseId: { type: 'string', minLength: 1 },
          input: {},
          principalFixtureId: { type: 'string', minLength: 1 },
          clock: {
            type: 'string',
            pattern:
              '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z$',
          },
          hostFixtures: {
            type: 'object',
            additionalProperties: false,
            required: ['calls'],
            properties: {
              calls: {
                type: 'array',
                items: {
                  oneOf: [
                    recordsFixtureCallSchema,
                    connectorFixtureCallSchema,
                    aiFixtureCallSchema,
                  ],
                },
              },
            },
          },
          expect: {
            oneOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['outcome', 'output', 'mutations'],
                properties: {
                  outcome: { const: 'success' },
                  output: {},
                  mutations: { type: 'array' },
                  maxUsage: { type: 'object' },
                },
              },
              {
                type: 'object',
                additionalProperties: false,
                required: ['outcome', 'errorCode', 'mutations'],
                properties: {
                  outcome: { const: 'error' },
                  errorCode: { type: 'string', minLength: 1 },
                  mutations: { type: 'array', maxItems: 0 },
                  maxUsage: { type: 'object' },
                },
              },
            ],
          },
        },
      },
    },
  },
};
