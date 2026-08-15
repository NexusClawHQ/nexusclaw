export const METADATA_RUNTIME_TAXONOMY_KINDS = [
  'roles',
  'apps',
  'relationships',
  'layouts',
  'record-pages',
  'views',
  'menus',
  'report-folders',
  'dashboards',
  'reports',
  'actions',
  'flows',
  'approvals',
  'prompts',
  'agents',
  'permissionsets',
  'permissions',
] as const;

export type MetadataRuntimeTaxonomyKind = typeof METADATA_RUNTIME_TAXONOMY_KINDS[number];

const SINGULAR_KIND_BY_PLURAL: Record<MetadataRuntimeTaxonomyKind, string> = {
  roles: 'role',
  apps: 'app',
  relationships: 'relationship',
  layouts: 'layout',
  'record-pages': 'record-page',
  views: 'view',
  menus: 'menu',
  'report-folders': 'report-folder',
  dashboards: 'dashboard',
  reports: 'report',
  actions: 'action',
  flows: 'flow',
  approvals: 'approval',
  prompts: 'prompt',
  agents: 'agent',
  permissionsets: 'permissionset',
  permissions: 'permission',
};

const PLURAL_KIND_BY_SINGULAR = Object.fromEntries(
  Object.entries(SINGULAR_KIND_BY_PLURAL).map(([plural, singular]) => [singular, plural]),
) as Record<string, MetadataRuntimeTaxonomyKind>;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function sanitizeSegment(value: string): string {
  return value.replace(/[\\/]/g, '_');
}

function resolvePermissionOwnerType(payload: Record<string, unknown>): 'permissionset' | 'role' {
  if (asString(payload.ownerType) === 'role' || asString(payload.roleApiName)) {
    return 'role';
  }

  return 'permissionset';
}

export function isMetadataRuntimeTaxonomyKind(value: unknown): value is MetadataRuntimeTaxonomyKind {
  return typeof value === 'string' && (METADATA_RUNTIME_TAXONOMY_KINDS as readonly string[]).includes(value);
}

export function metadataRuntimeSingularKind(kind: MetadataRuntimeTaxonomyKind): string {
  return SINGULAR_KIND_BY_PLURAL[kind];
}

export function inferMetadataRuntimeTaxonomyKind(filePath: string): MetadataRuntimeTaxonomyKind | null {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.?\//, '');
  const directRoot = normalized.split('/')[0];

  if (isMetadataRuntimeTaxonomyKind(directRoot)) {
    return directRoot;
  }

  const suffixMatch = normalized.match(/\.([a-z]+)\.(json|ya?ml)$/i);
  const singular = suffixMatch?.[1]?.toLowerCase();
  if (singular && PLURAL_KIND_BY_SINGULAR[singular]) {
    return PLURAL_KIND_BY_SINGULAR[singular];
  }

  return null;
}

export function getMetadataRuntimeEnvelopeKey(kind: MetadataRuntimeTaxonomyKind): string {
  return metadataRuntimeSingularKind(kind);
}

export function getMetadataRuntimeComponentIdentity(
  kind: MetadataRuntimeTaxonomyKind,
  payload: Record<string, unknown>,
): string {
  switch (kind) {
    case 'roles':
    case 'apps':
    case 'dashboards':
    case 'reports':
    case 'actions':
    case 'flows':
    case 'approvals':
    case 'agents':
    case 'permissionsets':
      return asString(payload.apiName) ?? asString(payload.name) ?? asString(payload.label) ?? 'unknown';
    case 'layouts':
    case 'record-pages':
    case 'views': {
      const objectNameSingular = asString(payload.objectNameSingular) ?? 'unknown-object';
      const apiName = asString(payload.apiName) ?? asString(payload.name) ?? asString(payload.label) ?? 'unknown';
      return `${objectNameSingular}.${apiName}`;
    }
    case 'relationships': {
      const objectNameSingular = asString(payload.objectNameSingular) ?? 'unknown-object';
      const fieldName = asString(payload.fieldName) ?? asString(payload.name) ?? 'unknown';
      return `${objectNameSingular}.${fieldName}`;
    }
    case 'menus': {
      const appApiName = asString(payload.appApiName) ?? 'unknown-app';
      const apiName = asString(payload.apiName) ?? asString(payload.name) ?? 'unknown';
      return `${appApiName}.${apiName}`;
    }
    case 'report-folders': {
      const folderType = asString(payload.folderType) ?? 'REPORT';
      const apiName = asString(payload.apiName) ?? asString(payload.name) ?? 'unknown';
      return `${folderType}.${apiName}`;
    }
    case 'prompts': {
      const promptType = asString(payload.promptType) ?? 'template';
      const base = asString(payload.apiName) ?? asString(payload.scene) ?? asString(payload.name) ?? 'unknown';
      return `${promptType}.${base}`;
    }
    case 'permissions': {
      const ownerType = resolvePermissionOwnerType(payload);
      const ownerApiName = ownerType === 'role'
        ? asString(payload.roleApiName) ?? 'unknown-role'
        : asString(payload.permissionSetApiName) ?? 'unknown-permissionset';
      const permissionType = asString(payload.permissionType) ?? 'unknown';
      const objectNameSingular = asString(payload.objectNameSingular);
      const fieldName = asString(payload.fieldName);
      const appApiName = asString(payload.appApiName);
      const menuApiName = asString(payload.menuApiName);
      const permissionName = asString(payload.permissionName);

      const leaf =
        permissionName
        ?? (objectNameSingular && fieldName ? `${objectNameSingular}.${fieldName}` : undefined)
        ?? objectNameSingular
        ?? appApiName
        ?? menuApiName
        ?? permissionType;
      if (ownerType === 'role') {
        return `role:${ownerApiName}.${permissionType}.${leaf}`;
      }
      return `${ownerApiName}.${permissionType}.${leaf}`;
    }
    default:
      return 'unknown';
  }
}

export function buildMetadataRuntimeTaxonomyFilePath(
  kind: MetadataRuntimeTaxonomyKind,
  payload: Record<string, unknown>,
  format: 'json' | 'yaml',
): string {
  const extension = format === 'json' ? 'json' : 'yaml';
  const apiName = sanitizeSegment(
    asString(payload.apiName) ?? asString(payload.name) ?? asString(payload.label) ?? 'unknown',
  );

  switch (kind) {
    case 'roles': {
      const roleApiName = sanitizeSegment(asString(payload.apiName) ?? asString(payload.name) ?? 'unknown');
      return `roles/${roleApiName}/role.${extension}`;
    }
    case 'apps':
      return `apps/${apiName}.app.${extension}`;
    case 'relationships': {
      const objectNameSingular = sanitizeSegment(asString(payload.objectNameSingular) ?? 'unknown-object');
      const fieldName = sanitizeSegment(asString(payload.fieldName) ?? asString(payload.name) ?? 'unknown');
      return `objects/${objectNameSingular}/relationships/${fieldName}.relationship.${extension}`;
    }
    case 'layouts': {
      const objectNameSingular = sanitizeSegment(asString(payload.objectNameSingular) ?? 'unknown-object');
      return `layouts/${objectNameSingular}/${apiName}.layout.${extension}`;
    }
    case 'record-pages': {
      const objectNameSingular = sanitizeSegment(asString(payload.objectNameSingular) ?? 'unknown-object');
      return `record-pages/${objectNameSingular}/${apiName}.record-page.${extension}`;
    }
    case 'views': {
      const objectNameSingular = sanitizeSegment(asString(payload.objectNameSingular) ?? 'unknown-object');
      return `views/${objectNameSingular}/${apiName}.view.${extension}`;
    }
    case 'menus': {
      const appApiName = sanitizeSegment(asString(payload.appApiName) ?? 'unknown-app');
      return `menus/${appApiName}/${apiName}.menu.${extension}`;
    }
    case 'report-folders': {
      const folderType = sanitizeSegment(asString(payload.folderType) ?? 'REPORT');
      return `report-folders/${folderType}/${apiName}.report-folder.${extension}`;
    }
    case 'dashboards':
      return `dashboards/${apiName}.dashboard.${extension}`;
    case 'reports': {
      const folderApiName = sanitizeSegment(asString(payload.folderApiName) ?? 'root');
      return `reports/${folderApiName}/${apiName}.report.${extension}`;
    }
    case 'actions':
      return `actions/${apiName}.action.${extension}`;
    case 'flows':
      return `flows/${apiName}.flow.${extension}`;
    case 'approvals':
      return `approvals/${apiName}.approval.${extension}`;
    case 'prompts': {
      const promptType = sanitizeSegment(asString(payload.promptType) ?? 'template');
      return `prompts/${promptType}/${apiName}.prompt.${extension}`;
    }
    case 'agents':
      return `agents/${apiName}.agent.${extension}`;
    case 'permissionsets': {
      const permissionSetApiName = sanitizeSegment(asString(payload.apiName) ?? asString(payload.label) ?? 'unknown');
      return `permissionsets/${permissionSetApiName}/permissionset.${extension}`;
    }
    case 'permissions': {
      const ownerType = resolvePermissionOwnerType(payload);
      const ownerApiName = sanitizeSegment(
        ownerType === 'role'
          ? asString(payload.roleApiName) ?? 'unknown-role'
          : asString(payload.permissionSetApiName) ?? 'unknown-permissionset',
      );
      const permissionName = sanitizeSegment(
        asString(payload.permissionName)
          ?? asString(payload.fieldName)
          ?? asString(payload.objectNameSingular)
          ?? asString(payload.appApiName)
          ?? asString(payload.menuApiName)
          ?? asString(payload.permissionType)
          ?? 'unknown',
      );
      if (ownerType === 'role') {
        return `roles/${ownerApiName}/permissions/${permissionName}.permission.${extension}`;
      }
      return `permissionsets/${ownerApiName}/permissions/${permissionName}.permission.${extension}`;
    }
  }
}

export function getMetadataRuntimeEnvelopePayload(
  document: Record<string, unknown>,
  kind: MetadataRuntimeTaxonomyKind,
): Record<string, unknown> | null {
  const envelopeKey = getMetadataRuntimeEnvelopeKey(kind);
  const nested = asRecord(document[envelopeKey]);
  if (nested) {
    return nested;
  }

  if (document.kind) {
    const passthrough = { ...document };
    delete passthrough.kind;
    delete passthrough.schemaVersion;
    return passthrough;
  }

  return asRecord(document) ?? null;
}
