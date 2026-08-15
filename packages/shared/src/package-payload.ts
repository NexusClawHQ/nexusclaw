export const PACKAGE_PAYLOAD_SCHEMA_VERSION = 'payload/v1' as const;

export type PackagePayloadSchemaVersion = typeof PACKAGE_PAYLOAD_SCHEMA_VERSION;

export const PACKAGE_PAYLOAD_KINDS = [
  'objects', 'fields', 'layouts', 'views', 'flows', 'approvals',
  'record-pages', 'menus', 'report-folders', 'roles', 'reports',
  'dashboards', 'prompts', 'agents', 'permissions', 'owd-settings',
  'org-nodes', 'object-permissions', 'field-permissions',
  'prompt-strategies', 'ai-providers', 'user-role-assignments',
  'pool-settings', 'plugins', 'records',
] as const;

export type PayloadKind = (typeof PACKAGE_PAYLOAD_KINDS)[number];

export interface PayloadMetadata {
  packageName: string;
  packageVersion: string;
  generatedAt?: string;
  generator?: string;
  sourceModuleId?: string;
  description?: string;
}

export interface PayloadDocument<T = unknown> {
  schemaVersion: PackagePayloadSchemaVersion;
  moduleId: string;
  kind: PayloadKind;
  metadata: PayloadMetadata;
  data: T;
}

export interface PackagePayload {
  schemaVersion: PackagePayloadSchemaVersion;
  documents: PayloadDocument[];
}

export interface ValidationError {
  path: string;
  code: string;
  message: string;
}

export interface ValidationWarning {
  path: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ParsedPayloadFile {
  path: string;
  document: PayloadDocument;
}

export interface PackagePayloadFile {
  path: string;
  content: string;
}

export interface VirtualPackageFile {
  path: string;
  content: string;
}

export interface LoadedPackagePayload {
  payload: PackagePayload;
  files: ParsedPayloadFile[];
}

export enum PackageFormat {
  PAYLOAD = 'payload',
  METADATA = 'metadata',
  UNKNOWN = 'unknown',
}

export interface LoadedPackage {
  format: PackageFormat;
  payload?: PackagePayload;
  payloadFiles?: ParsedPayloadFile[];
  warnings: string[];
}

const PAYLOAD_KIND_SET = new Set<string>(PACKAGE_PAYLOAD_KINDS);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validatePackagePayloadKind(
  kind: PayloadKind,
  data: unknown,
  path = 'data',
): ValidationResult {
  const errors: ValidationError[] = [];
  if (!PAYLOAD_KIND_SET.has(kind)) {
    errors.push({
      path,
      code: 'UNSUPPORTED_KIND',
      message: `unsupported payload kind "${String(kind)}"`,
    });
  } else if (!Array.isArray(data)) {
    errors.push({
      path,
      code: 'INVALID_KIND_DATA',
      message: `${kind} payload must provide an array`,
    });
  } else {
    data.forEach((entry, index) => {
      if (!isPlainObject(entry)) {
        errors.push({
          path: `${path}[${index}]`,
          code: 'INVALID_ENTRY',
          message: `${kind} entries must be objects`,
        });
      }
    });
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validatePackagePayload(input: PackagePayload): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (input.schemaVersion !== PACKAGE_PAYLOAD_SCHEMA_VERSION) {
    errors.push({
      path: 'schemaVersion',
      code: 'UNSUPPORTED_SCHEMA_VERSION',
      message: `payload schemaVersion must be "${PACKAGE_PAYLOAD_SCHEMA_VERSION}"`,
    });
  }
  if (!Array.isArray(input.documents)) {
    errors.push({
      path: 'documents',
      code: 'INVALID_DOCUMENTS',
      message: 'payload.documents must be an array',
    });
    return { valid: false, errors, warnings };
  }

  const seenModuleIds = new Set<string>();
  input.documents.forEach((document, index) => {
    const path = `documents[${index}]`;
    if (!isPlainObject(document)) {
      errors.push({
        path,
        code: 'INVALID_DOCUMENT',
        message: 'payload document must be an object',
      });
      return;
    }
    if (document.schemaVersion !== PACKAGE_PAYLOAD_SCHEMA_VERSION) {
      errors.push({
        path: `${path}.schemaVersion`,
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        message: `document schemaVersion must be "${PACKAGE_PAYLOAD_SCHEMA_VERSION}"`,
      });
    }
    if (!isNonEmptyString(document.moduleId)) {
      errors.push({
        path: `${path}.moduleId`,
        code: 'MISSING_MODULE_ID',
        message: 'moduleId is required',
      });
    } else if (seenModuleIds.has(document.moduleId)) {
      errors.push({
        path: `${path}.moduleId`,
        code: 'DUPLICATE_MODULE_ID',
        message: `duplicate moduleId "${document.moduleId}"`,
      });
    } else {
      seenModuleIds.add(document.moduleId);
    }
    if (!PAYLOAD_KIND_SET.has(document.kind)) {
      errors.push({
        path: `${path}.kind`,
        code: 'UNSUPPORTED_KIND',
        message: `unsupported payload kind "${String(document.kind)}"`,
      });
    }
    if (!isPlainObject(document.metadata)) {
      errors.push({
        path: `${path}.metadata`,
        code: 'INVALID_METADATA',
        message: 'metadata must be an object',
      });
    } else {
      if (!isNonEmptyString(document.metadata.packageName)) {
        errors.push({
          path: `${path}.metadata.packageName`,
          code: 'MISSING_PACKAGE_NAME',
          message: 'metadata.packageName is required',
        });
      }
      if (!isNonEmptyString(document.metadata.packageVersion)) {
        errors.push({
          path: `${path}.metadata.packageVersion`,
          code: 'MISSING_PACKAGE_VERSION',
          message: 'metadata.packageVersion is required',
        });
      }
    }
    if (PAYLOAD_KIND_SET.has(document.kind)) {
      const result = validatePackagePayloadKind(
        document.kind as PayloadKind,
        document.data,
        `${path}.data`,
      );
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}
