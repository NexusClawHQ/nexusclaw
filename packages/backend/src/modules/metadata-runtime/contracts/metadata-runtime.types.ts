export const METADATA_RUNTIME_SCHEMA_VERSION = 'metadata-runtime/v1' as const;

export type MetadataRuntimeFileFormat = 'json' | 'yaml';
export type MetadataRuntimeLayout = 'single-file' | 'split-file';
export type MetadataRuntimeSeverity = 'error' | 'warning';
export type MetadataRuntimeChangeAction = 'create' | 'update' | 'delete';
export type MetadataRuntimeChangeKind =
  | 'object'
  | 'field'
  | 'roles'
  | 'apps'
  | 'relationships'
  | 'layouts'
  | 'record-pages'
  | 'views'
  | 'menus'
  | 'report-folders'
  | 'dashboards'
  | 'reports'
  | 'actions'
  | 'flows'
  | 'approvals'
  | 'prompts'
  | 'agents'
  | 'permissionsets'
  | 'permissions';

export interface MetadataRuntimeReferenceHints {
  labelIdentifierFieldName?: string;
  imageIdentifierFieldName?: string;
  rollup?: {
    childObjectNameSingular?: string;
    relationFieldName?: string;
    childFieldName?: string;
  };
}

export interface MetadataRuntimeField {
  id?: string;
  objectMetadataId?: string;
  type: string;
  name: string;
  label: string;
  description?: string;
  icon?: string;
  isCustom?: boolean;
  isActive?: boolean;
  isSystem?: boolean;
  isNullable?: boolean;
  isUnique?: boolean;
  defaultValue?: unknown;
  options?: unknown;
  settings?: Record<string, unknown> | null;
  isLabelSyncedWithName?: boolean;
  translations?: Record<string, {
    label?: string;
    description?: string;
    options?: Record<string, string>;
  }>;
  relationDefinition?: Record<string, unknown> | null;
  referenceHints?: MetadataRuntimeReferenceHints;
  createdAt?: string;
  updatedAt?: string;
}

export interface MetadataRuntimeObject {
  id?: string;
  workspaceId?: string;
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  description?: string;
  icon?: string;
  isCustom?: boolean;
  isRemote?: boolean;
  isActive?: boolean;
  isSystem?: boolean;
  isSearchable?: boolean;
  labelIdentifierFieldMetadataId?: string;
  imageIdentifierFieldMetadataId?: string;
  shortcut?: string;
  isLabelSyncedWithName?: boolean;
  keyPrefix?: string;
  translations?: Record<string, {
    labelSingular?: string;
    labelPlural?: string;
    description?: string;
  }>;
  settings?: Record<string, unknown> | null;
  referenceHints?: MetadataRuntimeReferenceHints;
  fields: MetadataRuntimeField[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MetadataRuntimeSnapshot {
  schemaVersion: typeof METADATA_RUNTIME_SCHEMA_VERSION;
  workspaceId?: string;
  metadata?: {
    generatedAt?: string;
    source?: string;
    revision?: string;
  };
  objects: MetadataRuntimeObject[];
  roles?: Record<string, unknown>[];
  apps?: Record<string, unknown>[];
  relationships?: Record<string, unknown>[];
  layouts?: Record<string, unknown>[];
  'record-pages'?: Record<string, unknown>[];
  views?: Record<string, unknown>[];
  menus?: Record<string, unknown>[];
  'report-folders'?: Record<string, unknown>[];
  dashboards?: Record<string, unknown>[];
  reports?: Record<string, unknown>[];
  actions?: Record<string, unknown>[];
  flows?: Record<string, unknown>[];
  approvals?: Record<string, unknown>[];
  prompts?: Record<string, unknown>[];
  agents?: Record<string, unknown>[];
  permissionsets?: Record<string, unknown>[];
  permissions?: Record<string, unknown>[];
}

export interface MetadataRuntimeObjectFile {
  schemaVersion: typeof METADATA_RUNTIME_SCHEMA_VERSION;
  kind: 'object';
  object: MetadataRuntimeObject;
}

export interface MetadataRuntimeFieldFile {
  schemaVersion: typeof METADATA_RUNTIME_SCHEMA_VERSION;
  kind: 'field';
  objectNameSingular: string;
  field: MetadataRuntimeField;
}

export interface MetadataRuntimeSourceFile {
  path: string;
  content: string;
}

export interface MetadataRuntimeLoadedFile extends MetadataRuntimeSourceFile {
  format: MetadataRuntimeFileFormat;
  document: unknown;
}

export interface MetadataRuntimeDiagnostic {
  code: string;
  message: string;
  severity: MetadataRuntimeSeverity;
  path?: string;
  line?: number;
  column?: number;
}

export interface MetadataRuntimeValidationResult {
  valid: boolean;
  diagnostics: MetadataRuntimeDiagnostic[];
  summary: string[];
}

export interface MetadataRuntimePropertyChange {
  property: string;
  before?: unknown;
  after?: unknown;
}

export interface MetadataRuntimeChange {
  kind: MetadataRuntimeChangeKind;
  action: MetadataRuntimeChangeAction;
  objectNameSingular: string;
  fieldName?: string;
  componentIdentity?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  propertyChanges: MetadataRuntimePropertyChange[];
}

export interface MetadataRuntimeDiff {
  baseline: 'snapshot' | 'database' | 'revision';
  changes: MetadataRuntimeChange[];
  summary: {
    objects: {
      created: number;
      updated: number;
      deleted: number;
    };
    fields: {
      created: number;
      updated: number;
      deleted: number;
    };
    taxonomy?: Partial<Record<
      Exclude<MetadataRuntimeChangeKind, 'object' | 'field'>,
      {
        created: number;
        updated: number;
        deleted: number;
      }
    >>;
  };
  humanSummary: string[];
}

export interface MetadataRuntimeImportPlan {
  dryRun: boolean;
  destructiveSync: boolean;
  snapshot: MetadataRuntimeSnapshot;
  validation: MetadataRuntimeValidationResult;
  diff: MetadataRuntimeDiff;
}

export interface MetadataRuntimeApplyResult {
  applied: boolean;
  dryRun: boolean;
  destructiveSync: boolean;
  plan: MetadataRuntimeImportPlan;
  beforeRevision?: string;
  afterRevision?: string;
}

export interface MetadataRuntimeExportOptions {
  format?: MetadataRuntimeFileFormat;
  layout?: MetadataRuntimeLayout;
}

export interface MetadataRuntimeRenderedFile extends MetadataRuntimeSourceFile {
  hash: string;
  format: MetadataRuntimeFileFormat;
}

export interface MetadataRuntimeDiffOptions {
  ignoreFields?: string[];
  baseline?: 'snapshot' | 'database' | 'revision';
}
