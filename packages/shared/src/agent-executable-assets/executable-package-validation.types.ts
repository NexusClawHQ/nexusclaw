import type { CliDiagnosticV1 } from './cli-contract.types';
import type { Sha256Digest } from './workforce-lock.types';

export const EXECUTABLE_PACKAGE_VALIDATION_INPUT_VERSION =
  'nexusclaw.validate-executable-package-artifact-input/v1' as const;
export const EXECUTABLE_PACKAGE_VALIDATION_RESULT_VERSION =
  'nexusclaw.validate-executable-package-artifact-result/v1' as const;

export interface ValidateExecutablePackageArtifactInputV1 {
  readonly schemaVersion: typeof EXECUTABLE_PACKAGE_VALIDATION_INPUT_VERSION;
  readonly targetWorkspaceId: string;
  readonly stagedArtifactId: string;
  readonly expectedArchiveDigest: Sha256Digest;
  readonly expectedPackageDigest: Sha256Digest;
  readonly contextManifestContentDigest: Sha256Digest;
}

export interface ValidateExecutablePackageArtifactResultV1 {
  readonly schemaVersion: typeof EXECUTABLE_PACKAGE_VALIDATION_RESULT_VERSION;
  readonly valid: boolean;
  readonly stagedArtifactId: string;
  readonly archiveDigest: Sha256Digest;
  readonly packageDigest: Sha256Digest;
  readonly contextManifestContentDigest: Sha256Digest;
  readonly diagnostics: ReadonlyArray<CliDiagnosticV1>;
}

const digestSchema = { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' } as const;

/** Pure JSON Schema contract; no GraphQLJSON, filesystem path or byte field. */
export const validateExecutablePackageArtifactInputSchema = {
  $id: EXECUTABLE_PACKAGE_VALIDATION_INPUT_VERSION,
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion', 'targetWorkspaceId', 'stagedArtifactId',
    'expectedArchiveDigest', 'expectedPackageDigest', 'contextManifestContentDigest',
  ],
  properties: {
    schemaVersion: { const: EXECUTABLE_PACKAGE_VALIDATION_INPUT_VERSION },
    targetWorkspaceId: { type: 'string', minLength: 1 },
    stagedArtifactId: { type: 'string', minLength: 1 },
    expectedArchiveDigest: digestSchema,
    expectedPackageDigest: digestSchema,
    contextManifestContentDigest: digestSchema,
  },
} as const;

export const validateExecutablePackageArtifactResultSchema = {
  $id: EXECUTABLE_PACKAGE_VALIDATION_RESULT_VERSION,
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion', 'valid', 'stagedArtifactId', 'archiveDigest',
    'packageDigest', 'contextManifestContentDigest', 'diagnostics',
  ],
  properties: {
    schemaVersion: { const: EXECUTABLE_PACKAGE_VALIDATION_RESULT_VERSION },
    valid: { type: 'boolean' },
    stagedArtifactId: { type: 'string', minLength: 1 },
    archiveDigest: digestSchema,
    packageDigest: digestSchema,
    contextManifestContentDigest: digestSchema,
    diagnostics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'severity', 'phase', 'message', 'retryable'],
        properties: {
          code: { type: 'string' },
          severity: { enum: ['error', 'warning', 'info'] },
          phase: { type: 'string' },
          artifactId: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer', minimum: 1 },
          column: { type: 'integer', minimum: 1 },
          jsonPath: { type: 'string' },
          ruleId: { type: 'string' },
          message: { type: 'string' },
          fixHint: { type: 'string' },
          retryable: { type: 'boolean' },
          docsRef: { type: 'string' },
        },
      },
    },
  },
} as const;
