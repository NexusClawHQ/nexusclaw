// Page Source File — canonical format contract for CustomPage source DX.
// This module is shared between backend and CLI; it MUST NOT import
// nestjs / typeorm / graphql or any runtime-only dependency.

// ---------------------------------------------------------------------------
// Enums & Constants
// ---------------------------------------------------------------------------

export const PAGE_SOURCE_MAIN_SUFFIX = '.page.json' as const;
export const PAGE_SOURCE_SCHEMA_SUFFIX = '.page.schema.json' as const;
export const PAGE_SCHEMA_EXTERNAL_PREFIX = '@external:' as const;

/**
 * Canonical field order for serialized page source files.
 * Order matters: it defines the stable key sequence in the output JSON.
 */
export const DEPLOYABLE_FIELDS = [
  'apiName',
  'name',
  'description',
  'type',
  'status',
  'objectName',
  'schema',
  'version',
  'icon',
  'route',
  'isActive',
  'isSystem',
] as const;

export type DeployableField = (typeof DEPLOYABLE_FIELDS)[number];

export const PAGE_TYPES = ['record', 'list', 'app', 'utility'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const PAGE_STATUSES = ['draft', 'published', 'archived'] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

export const API_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
export const API_NAME_MAX_LENGTH = 100;

// ---------------------------------------------------------------------------
// CustomPageLike — standalone type (no backend entity dependency)
// ---------------------------------------------------------------------------

export interface CustomPageLike {
  apiName: string;
  name: string;
  description: string | null;
  type: PageType;
  status: PageStatus;
  objectName: string | null;
  schema: Record<string, unknown>;
  version: number;
  icon: string | null;
  route: string | null;
  isActive: boolean;
  isSystem: boolean;
}

// ---------------------------------------------------------------------------
// Bundle & Parse result types
// ---------------------------------------------------------------------------

export interface PageSourceFileBundle {
  mainFileName: string;
  mainContent: string;
  schemaFileName: string;
  schemaContent: string;
}

export interface PageSourceFileParseError {
  path: string;
  reason:
    | 'missing-field'
    | 'unknown-field'
    | 'apiname-mismatch'
    | 'invalid-enum'
    | 'invalid-json'
    | 'schema-missing';
  detail: string;
}

export type PageSourceFileParseResult =
  | { ok: true; partial: CustomPageLike }
  | { ok: false; errors: PageSourceFileParseError[] };

// ---------------------------------------------------------------------------
// canonicalStringify
// ---------------------------------------------------------------------------

/**
 * Produce canonical JSON text.
 * - 2-space indent
 * - LF line endings (no CR)
 * - Trailing LF at end of file
 * - Optionally sort object keys recursively (used for schema sidecar)
 */
export function canonicalStringify(
  value: unknown,
  options: { sortKeys: boolean } = { sortKeys: false },
): string {
  const replacer = options.sortKeys ? sortKeysReplacer : undefined;
  const json = JSON.stringify(value, replacer, 2);
  // Ensure LF line endings and trailing LF
  return json.replace(/\r\n/g, '\n').replace(/\r/g, '\n') + '\n';
}

function sortKeysReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

// ---------------------------------------------------------------------------
// serializePageSourceFile
// ---------------------------------------------------------------------------

/**
 * Serialize a CustomPageLike entity into a dual-file bundle.
 * - Main file: DEPLOYABLE_FIELDS in canonical order, schema replaced with external ref
 * - Schema sidecar: deep key-sorted canonical JSON of the schema object
 */
export function serializePageSourceFile(entity: CustomPageLike): PageSourceFileBundle {
  const apiName = entity.apiName;
  const schemaFileName = `${apiName}${PAGE_SOURCE_SCHEMA_SUFFIX}`;
  const externalRef = `${PAGE_SCHEMA_EXTERNAL_PREFIX}${schemaFileName}`;

  // Build main object in DEPLOYABLE_FIELDS order
  const mainObj: Record<string, unknown> = {};
  for (const field of DEPLOYABLE_FIELDS) {
    if (field === 'schema') {
      mainObj[field] = externalRef;
    } else {
      mainObj[field] = entity[field];
    }
  }

  const mainContent = canonicalStringify(mainObj, { sortKeys: false });
  const schemaContent = canonicalStringify(entity.schema, { sortKeys: true });

  return {
    mainFileName: `${apiName}${PAGE_SOURCE_MAIN_SUFFIX}`,
    mainContent,
    schemaFileName,
    schemaContent,
  };
}

// ---------------------------------------------------------------------------
// parsePageSourceFile
// ---------------------------------------------------------------------------

export interface ParsePageSourceFileInput {
  mainContent: string;
  schemaContent: string | null;
  sourcePath: string;
}

/**
 * Parse a page source file bundle back into a CustomPageLike.
 * Validates strictly per design §3.1 parse rules.
 */
export function parsePageSourceFile(input: ParsePageSourceFileInput): PageSourceFileParseResult {
  const { mainContent, schemaContent, sourcePath } = input;
  const errors: PageSourceFileParseError[] = [];

  // 1. Parse main JSON
  let mainObj: Record<string, unknown>;
  try {
    mainObj = JSON.parse(mainContent) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      errors: [
        {
          path: sourcePath,
          reason: 'invalid-json',
          detail: 'Main file is not valid JSON',
        },
      ],
    };
  }

  if (mainObj === null || typeof mainObj !== 'object' || Array.isArray(mainObj)) {
    return {
      ok: false,
      errors: [
        {
          path: sourcePath,
          reason: 'invalid-json',
          detail: 'Main file root must be a JSON object',
        },
      ],
    };
  }

  // 2. Check for unknown fields
  const knownFields = new Set<string>(DEPLOYABLE_FIELDS as unknown as string[]);
  const unknownFields = Object.keys(mainObj).filter((k) => !knownFields.has(k));
  if (unknownFields.length > 0) {
    errors.push({
      path: sourcePath,
      reason: 'unknown-field',
      detail: `Unknown fields: ${unknownFields.join(', ')}`,
    });
  }

  // 3. Check required fields (all DEPLOYABLE_FIELDS must be present)
  const missingFields = DEPLOYABLE_FIELDS.filter((f) => !(f in mainObj));
  for (const field of missingFields) {
    errors.push({
      path: sourcePath,
      reason: 'missing-field',
      detail: `Missing required field: ${field}`,
    });
  }

  // If we have structural errors, return early
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // 4. Validate apiName vs file stem
  const stem = extractStemFromPath(sourcePath);
  const apiName = mainObj.apiName as string;

  if (typeof apiName !== 'string' || apiName.length === 0) {
    errors.push({
      path: sourcePath,
      reason: 'missing-field',
      detail: 'Missing required field: apiName',
    });
    return { ok: false, errors };
  }

  if (stem !== null && stem !== apiName) {
    errors.push({
      path: sourcePath,
      reason: 'apiname-mismatch',
      detail: `apiName mismatch: file stem is "${stem}" but apiName field is "${apiName}"`,
    });
  }

  // 5. Validate enums
  const typeValue = mainObj.type as string;
  if (!PAGE_TYPES.includes(typeValue as PageType)) {
    errors.push({
      path: sourcePath,
      reason: 'invalid-enum',
      detail: `Invalid type: "${typeValue}". Allowed values: ${PAGE_TYPES.join(', ')}`,
    });
  }

  const statusValue = mainObj.status as string;
  if (!PAGE_STATUSES.includes(statusValue as PageStatus)) {
    errors.push({
      path: sourcePath,
      reason: 'invalid-enum',
      detail: `Invalid status: "${statusValue}". Allowed values: ${PAGE_STATUSES.join(', ')}`,
    });
  }

  // 6. Validate schema sidecar
  if (schemaContent === null || schemaContent === undefined) {
    errors.push({
      path: sourcePath,
      reason: 'schema-missing',
      detail: `Schema sidecar file not found for apiName "${apiName}"`,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // 7. Parse schema sidecar
  let schemaObj: Record<string, unknown>;
  try {
    schemaObj = JSON.parse(schemaContent!) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      errors: [
        {
          path: sourcePath,
          reason: 'invalid-json',
          detail: 'Schema sidecar file is not valid JSON',
        },
      ],
    };
  }

  if (schemaObj === null || typeof schemaObj !== 'object' || Array.isArray(schemaObj)) {
    return {
      ok: false,
      errors: [
        {
          path: sourcePath,
          reason: 'invalid-json',
          detail: 'Schema sidecar root must be a JSON object',
        },
      ],
    };
  }

  // 8. Build the partial
  const partial: CustomPageLike = {
    apiName: apiName,
    name: mainObj.name as string,
    description: mainObj.description as string | null,
    type: typeValue as PageType,
    status: statusValue as PageStatus,
    objectName: mainObj.objectName as string | null,
    schema: schemaObj,
    version: mainObj.version as number,
    icon: mainObj.icon as string | null,
    route: mainObj.route as string | null,
    isActive: mainObj.isActive as boolean,
    isSystem: mainObj.isSystem as boolean,
  };

  return { ok: true, partial };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the apiName stem from a file path.
 * e.g. "/path/to/lead_detail.page.json" → "lead_detail"
 * Returns null if the path doesn't match the expected suffix.
 */
function extractStemFromPath(sourcePath: string): string | null {
  const fileName = sourcePath.split('/').pop() ?? sourcePath;
  if (fileName.endsWith(PAGE_SOURCE_MAIN_SUFFIX)) {
    return fileName.slice(0, -PAGE_SOURCE_MAIN_SUFFIX.length);
  }
  // Also handle Windows-style paths
  const winFileName = sourcePath.split('\\').pop() ?? sourcePath;
  if (winFileName.endsWith(PAGE_SOURCE_MAIN_SUFFIX)) {
    return winFileName.slice(0, -PAGE_SOURCE_MAIN_SUFFIX.length);
  }
  return null;
}
