/**
 * Platform Admin route readiness is a cross-layer contract.
 *
 * Frontend routing/menu code, backend guard coverage and E2E probes all consume
 * this registry. Do not copy route paths or owner identifiers into parallel
 * inventories; attach layer-specific behavior by `path` or `owner` instead.
 */

export type PlatformAdminRouteKind =
  | 'CANONICAL'
  | 'DETAIL_ACTION'
  | 'ALIAS'
  | 'REGISTERED_HIDDEN'
  | 'LEGACY_REDIRECT'
  | 'RETIRED';

export type PlatformAdminIntegrationLevel =
  | 'R0_ROUTED'
  | 'R1_CONTRACTED'
  | 'R2_BACKED'
  | 'R3_ENVIRONMENT_PROVEN'
  | 'R4_RELEASE_EVIDENCED'
  | 'RETIRED';

export type PlatformAdminI18nLevel = 'PASS' | 'MINOR' | 'MAJOR' | 'BLOCKER';

export type PlatformAdminTenantScope =
  | 'NONE'
  | 'EXPLICIT_WORKSPACE'
  | 'REDIRECT_TO_ORG';

export type PlatformAdminRouteOwner =
  | 'platform-ops'
  | 'ai-provider-control-plane'
  | 'channel-provider-control-plane'
  | 'demo-access'
  | 'execution-log'
  | 'release-governance'
  | 'admin-panel'
  | 'navigation-boundary';

export type PlatformAdminMenuSectionKey =
  | 'platform-operations'
  | 'provider-control-plane'
  | 'support-governance'
  | 'release-governance'
  | 'platform-infrastructure';

export type PlatformAdminMenuIconKey =
  | 'dashboard'
  | 'team'
  | 'health'
  | 'billing'
  | 'renewal'
  | 'api'
  | 'channel'
  | 'security'
  | 'execution-log'
  | 'promotion'
  | 'rollout'
  | 'settings'
  | 'queues'
  | 'cron'
  | 'logs';

export interface PlatformAdminMenuDescriptor {
  key: string;
  section: PlatformAdminMenuSectionKey;
  labelKey: string;
  icon: PlatformAdminMenuIconKey;
  /** Stable non-localized metadata used to label generated E2E cases. */
  e2eGroup: string;
  e2eLabel: string;
}

export interface PlatformAdminRouteException {
  owner: PlatformAdminRouteOwner;
  reason: string;
  exitCriteria: string;
  /** Contract/test references proving the exception is registered. */
  evidence: readonly string[];
}

export interface PlatformAdminRouteReadinessEntry {
  path: string;
  kind: PlatformAdminRouteKind;
  owner: PlatformAdminRouteOwner;
  menu: false | PlatformAdminMenuDescriptor;
  parentPath?: string;
  fixtureStrategy?: string;
  target?: string;
  frontendGuard:
    | 'PlatformAdminProtectedRoute'
    | 'PlatformAdminAliasRedirect'
    | 'LegacyWorkspaceAdminRedirect'
    | 'NoRoute';
  backendGuard?: string;
  tenantScope: PlatformAdminTenantScope;
  integrationLevel: PlatformAdminIntegrationLevel;
  i18nLevel: PlatformAdminI18nLevel;
  evidenceIds: readonly string[];
  legacyNavigation?: 'primary' | 'child' | 'experimental';
  exception?: PlatformAdminRouteException;
}

export type PlatformAdminMenuRouteEntry = PlatformAdminRouteReadinessEntry & {
  menu: PlatformAdminMenuDescriptor;
};

export const PLATFORM_ADMIN_MENU_SECTIONS: readonly {
  key: PlatformAdminMenuSectionKey;
  titleKey: string;
}[] = [
  { key: 'platform-operations', titleKey: 'platformAdmin.sectionPlatformOperations' },
  { key: 'provider-control-plane', titleKey: 'platformAdmin.sectionProviderControlPlane' },
  { key: 'support-governance', titleKey: 'platformAdmin.sectionSupportGovernance' },
  { key: 'release-governance', titleKey: 'platformAdmin.sectionReleaseGovernance' },
  { key: 'platform-infrastructure', titleKey: 'platformAdmin.sectionPlatformInfrastructure' },
];

type StaticLabel =
  | 'REAL'
  | 'PARTIAL'
  | 'PARTIAL_HIGH'
  | 'BROKEN'
  | 'MOCK';

const labelToLevel: Record<StaticLabel, PlatformAdminIntegrationLevel> = {
  REAL: 'R2_BACKED',
  PARTIAL: 'R1_CONTRACTED',
  PARTIAL_HIGH: 'R1_CONTRACTED',
  BROKEN: 'R0_ROUTED',
  MOCK: 'R0_ROUTED',
};

type OwnedRouteOptions = {
  label: StaticLabel;
  i18n: PlatformAdminI18nLevel;
  tenantScope?: PlatformAdminTenantScope;
  backendGuard?: string;
  menu?: PlatformAdminMenuDescriptor;
  parentPath?: string;
  fixtureStrategy?: string;
  evidenceIds?: readonly string[];
};

const ownedRoute = (
  path: string,
  kind: 'CANONICAL' | 'DETAIL_ACTION',
  owner: Exclude<PlatformAdminRouteOwner, 'navigation-boundary'>,
  options: OwnedRouteOptions,
): PlatformAdminRouteReadinessEntry => ({
  path,
  kind,
  owner,
  menu: options.menu ?? false,
  parentPath: options.parentPath,
  fixtureStrategy: options.fixtureStrategy,
  frontendGuard: 'PlatformAdminProtectedRoute',
  backendGuard: options.backendGuard ?? 'PlatformAdminGuard',
  tenantScope: options.tenantScope ?? 'NONE',
  integrationLevel: labelToLevel[options.label],
  i18nLevel: options.i18n,
  evidenceIds: options.evidenceIds ?? [
    'platform-admin-route-readiness-v1/requirements.md§3.1',
  ],
});

const canonical = (
  path: string,
  owner: Exclude<PlatformAdminRouteOwner, 'navigation-boundary'>,
  options: OwnedRouteOptions,
) => ownedRoute(path, 'CANONICAL', owner, options);

const detailAction = (
  path: string,
  owner: Exclude<PlatformAdminRouteOwner, 'navigation-boundary'>,
  options: OwnedRouteOptions & {
    parentPath: string;
    fixtureStrategy: string;
  },
) => ownedRoute(path, 'DETAIL_ACTION', owner, options);

const alias = (
  path: string,
  owner: Exclude<PlatformAdminRouteOwner, 'navigation-boundary'>,
  target: string,
  frontendGuard: 'PlatformAdminProtectedRoute' | 'PlatformAdminAliasRedirect',
): PlatformAdminRouteReadinessEntry => ({
  path,
  kind: 'ALIAS',
  owner,
  menu: false,
  target,
  frontendGuard,
  tenantScope: 'NONE',
  integrationLevel: 'R0_ROUTED',
  i18nLevel: 'PASS',
  evidenceIds: ['platform-admin-route-readiness-v1/requirements.md§3.3'],
});

const hidden = (
  path: string,
  owner: Exclude<PlatformAdminRouteOwner, 'navigation-boundary'>,
  options: Omit<OwnedRouteOptions, 'menu'> & {
    reason: string;
    exitCriteria: string;
    evidence: readonly string[];
  },
): PlatformAdminRouteReadinessEntry => ({
  ...ownedRoute(path, 'CANONICAL', owner, options),
  kind: 'REGISTERED_HIDDEN',
  exception: {
    owner,
    reason: options.reason,
    exitCriteria: options.exitCriteria,
    evidence: options.evidence,
  },
  evidenceIds: options.evidence,
});

const retired = (
  path: string,
  owner: Exclude<PlatformAdminRouteOwner, 'navigation-boundary'>,
  options: {
    reason: string;
    exitCriteria: string;
    evidence: readonly string[];
  },
): PlatformAdminRouteReadinessEntry => ({
  path,
  kind: 'RETIRED',
  owner,
  menu: false,
  frontendGuard: 'NoRoute',
  tenantScope: 'NONE',
  integrationLevel: 'RETIRED',
  i18nLevel: 'PASS',
  evidenceIds: options.evidence,
  exception: {
    owner,
    reason: options.reason,
    exitCriteria: options.exitCriteria,
    evidence: options.evidence,
  },
});

const menu = (
  key: string,
  section: PlatformAdminMenuSectionKey,
  labelKey: string,
  icon: PlatformAdminMenuIconKey,
  e2eGroup: string,
  e2eLabel: string,
): PlatformAdminMenuDescriptor => ({
  key,
  section,
  labelKey,
  icon,
  e2eGroup,
  e2eLabel,
});

const LEGACY_ROUTE_DEFINITIONS: readonly {
  path: string;
  target: string;
  navigation: 'primary' | 'child' | 'experimental';
}[] = [
  { path: '/platform-admin/workspace-health', target: '/settings/operations/workspace-health', navigation: 'primary' },
  { path: '/platform-admin/workspace-health/drift', target: '/settings/operations/workspace-health/drift', navigation: 'child' },
  { path: '/platform-admin/workspace-health/revisions', target: '/settings/operations/workspace-health/revisions', navigation: 'child' },
  { path: '/platform-admin/workspace-health/comparison', target: '/settings/operations/workspace-health/comparison', navigation: 'child' },
  { path: '/platform-admin/metadata-packages/dependency-graph', target: '/settings/development/packages/dependency-graph', navigation: 'child' },
  { path: '/platform-admin/source-tracking', target: '/settings/development/source-tracking', navigation: 'primary' },
  { path: '/platform-admin/source-tracking/conflicts', target: '/settings/development/source-tracking/conflicts', navigation: 'child' },
  { path: '/platform-admin/source-tracking/baseline', target: '/settings/development/source-tracking/baseline', navigation: 'child' },
  { path: '/platform-admin/scheduled-jobs', target: '/settings/monitoring/scheduled-jobs', navigation: 'primary' },
  { path: '/platform-admin/api-monitoring', target: '/settings/monitoring/api', navigation: 'primary' },
  { path: '/platform-admin/debug-logs', target: '/settings/monitoring/debug-logs', navigation: 'primary' },
  { path: '/platform-admin/login-history', target: '/settings/security/login-history', navigation: 'primary' },
  { path: '/platform-admin/provider-control-plane/telephony', target: '/settings/telephony', navigation: 'primary' },
  { path: '/platform-admin/deployment-environments', target: '/settings/development/environments', navigation: 'primary' },
  { path: '/platform-admin/scratch-orgs', target: '/settings/development/scratch-orgs', navigation: 'experimental' },
  { path: '/platform-admin/sandboxes', target: '/settings/development/sandboxes', navigation: 'experimental' },
  { path: '/platform-admin/deployments', target: '/settings/development/deployments', navigation: 'primary' },
  { path: '/platform-admin/deployments/:changeSetId', target: '/settings/development/deployments/:changeSetId', navigation: 'child' },
  { path: '/platform-admin/deployments/:changeSetId/preview', target: '/settings/development/deployments/:changeSetId/preview', navigation: 'child' },
  { path: '/platform-admin/deployments/:changeSetId/progress', target: '/settings/development/deployments/:changeSetId/progress', navigation: 'child' },
  { path: '/platform-admin/deployments/history', target: '/settings/development/deployments/history', navigation: 'child' },
  { path: '/platform-admin/cicd', target: '/settings/development/cicd', navigation: 'primary' },
];

const legacyRedirect = (
  definition: (typeof LEGACY_ROUTE_DEFINITIONS)[number],
): PlatformAdminRouteReadinessEntry => ({
  path: definition.path,
  kind: 'LEGACY_REDIRECT',
  owner: 'navigation-boundary',
  menu: false,
  target: definition.target,
  frontendGuard: 'LegacyWorkspaceAdminRedirect',
  tenantScope: 'REDIRECT_TO_ORG',
  integrationLevel: 'R0_ROUTED',
  i18nLevel: 'PASS',
  evidenceIds: ['platform-admin-navigation-boundary-v1/readiness-proof'],
  legacyNavigation: definition.navigation,
});

/**
 * The single route registry. Entry order defines generated menu order; router
 * declaration order is intentionally irrelevant and is checked as a set.
 */
export const PLATFORM_ADMIN_ROUTE_READINESS: readonly PlatformAdminRouteReadinessEntry[] = [
  canonical('/platform-admin', 'platform-ops', {
    label: 'REAL',
    i18n: 'PASS',
    menu: menu('platform-admin-home', 'platform-operations', 'platformAdmin.menuPlatformAdminHome', 'dashboard', 'platform-admin/operations', '平台总览'),
  }),
  alias(
    '/platform-admin/ops',
    'platform-ops',
    '/platform-admin',
    'PlatformAdminProtectedRoute',
  ),
  canonical('/platform-admin/ops/subscriptions', 'platform-ops', {
    label: 'REAL',
    i18n: 'PASS',
    menu: menu('ops-subscriptions', 'platform-operations', 'platformAdmin.menuOpsSubscriptions', 'team', 'platform-admin/subscription-billing', '订阅管理'),
  }),
  detailAction('/platform-admin/ops/subscriptions/new', 'platform-ops', {
    label: 'REAL',
    i18n: 'PASS',
    parentPath: '/platform-admin/ops/subscriptions',
    fixtureStrategy: 'STATIC_CREATE_ACTION',
  }),
  detailAction('/platform-admin/ops/subscriptions/:id', 'platform-ops', {
    label: 'REAL',
    i18n: 'PASS',
    tenantScope: 'EXPLICIT_WORKSPACE',
    parentPath: '/platform-admin/ops/subscriptions',
    fixtureStrategy: 'PLATFORM_WORKSPACE_FIXTURE',
  }),
  canonical('/platform-admin/ops/health', 'platform-ops', {
    label: 'REAL',
    i18n: 'PASS',
    menu: menu('ops-health', 'platform-operations', 'platformAdmin.menuOpsHealth', 'health', 'platform-admin/subscription-billing', '租户健康度'),
  }),
  canonical('/platform-admin/ops/billing', 'platform-ops', {
    label: 'REAL',
    i18n: 'PASS',
    menu: menu('ops-billing', 'platform-operations', 'platformAdmin.menuOpsBilling', 'billing', 'platform-admin/subscription-billing', '计费概览'),
  }),
  detailAction('/platform-admin/ops/billing/:id', 'platform-ops', {
    label: 'REAL',
    i18n: 'PASS',
    parentPath: '/platform-admin/ops/billing',
    fixtureStrategy: 'PLATFORM_INVOICE_FIXTURE',
  }),
  canonical('/platform-admin/ops/renewals', 'platform-ops', {
    label: 'REAL',
    i18n: 'PASS',
    menu: menu('ops-renewals', 'platform-operations', 'platformAdmin.menuOpsRenewals', 'renewal', 'platform-admin/subscription-billing', '续费管理'),
  }),
  alias('/platform-admin/ops/users', 'platform-ops', '/platform-admin/ops/subscriptions', 'PlatformAdminAliasRedirect'),
  alias('/platform-admin/ops/users/:userId', 'platform-ops', '/platform-admin/ops/subscriptions', 'PlatformAdminAliasRedirect'),

  canonical('/platform-admin/provider-control-plane/ai', 'ai-provider-control-plane', {
    label: 'REAL',
    i18n: 'PASS',
    menu: menu('ai-provider-control-plane', 'provider-control-plane', 'platformAdmin.menuAiProvider', 'api', 'platform-admin/provider-control-plane', 'AI Provider'),
  }),
  canonical('/platform-admin/provider-control-plane/channel', 'channel-provider-control-plane', {
    label: 'REAL',
    i18n: 'PASS',
    menu: menu('channel-provider-control-plane', 'provider-control-plane', 'platformAdmin.menuChannelProvider', 'channel', 'platform-admin/provider-control-plane', 'Messaging Channels'),
  }),

  canonical('/platform-admin/demo-access', 'demo-access', {
    label: 'REAL',
    i18n: 'PASS',
    menu: menu('demo-access', 'support-governance', 'platformAdmin.menuDemoAccess', 'security', 'platform-admin/support-governance', 'Demo Access'),
  }),
  canonical('/platform-admin/execution-logs', 'execution-log', {
    label: 'REAL',
    i18n: 'PASS',
    tenantScope: 'EXPLICIT_WORKSPACE',
    menu: menu('execution-logs', 'support-governance', 'platformAdmin.menuTenantExecutionAudit', 'execution-log', 'platform-admin/runtime-monitoring', '执行日志'),
  }),
  detailAction('/platform-admin/execution-logs/:id', 'execution-log', {
    label: 'REAL',
    i18n: 'PASS',
    tenantScope: 'EXPLICIT_WORKSPACE',
    parentPath: '/platform-admin/execution-logs',
    fixtureStrategy: 'PLATFORM_EXECUTION_LOG_FIXTURE',
  }),

  alias(
    '/platform-admin/metadata-packages',
    'release-governance',
    '/platform-admin/metadata-packages/promotions',
    'PlatformAdminAliasRedirect',
  ),
  canonical('/platform-admin/metadata-packages/promotions', 'release-governance', {
    label: 'REAL',
    i18n: 'PASS',
    menu: menu('metadata-package-promotions', 'release-governance', 'platformAdmin.menuPackagePromotions', 'promotion', 'platform-admin/release-governance', 'Package Promotions'),
  }),
  canonical('/platform-admin/metadata-packages/rollouts', 'release-governance', {
    label: 'REAL',
    i18n: 'PASS',
    menu: menu('metadata-package-rollouts', 'release-governance', 'platformAdmin.menuPackageRollouts', 'rollout', 'platform-admin/release-governance', 'Staged Rollouts'),
  }),

  canonical('/platform-admin/admin-panel', 'admin-panel', {
    label: 'REAL',
    i18n: 'PASS',
    menu: menu('admin-panel', 'platform-infrastructure', 'platformAdmin.menuAdminPanel', 'settings', 'platform-admin/system-admin', '管理面板'),
  }),
  detailAction('/platform-admin/admin-panel/config/:variableName', 'admin-panel', {
    label: 'REAL',
    i18n: 'PASS',
    parentPath: '/platform-admin/admin-panel',
    fixtureStrategy: 'PLATFORM_CONFIG_VARIABLE_FIXTURE',
  }),
  detailAction('/platform-admin/admin-panel/health/:indicatorId', 'admin-panel', {
    label: 'REAL',
    i18n: 'PASS',
    parentPath: '/platform-admin/admin-panel',
    fixtureStrategy: 'PLATFORM_HEALTH_INDICATOR_FIXTURE',
  }),
  canonical('/platform-admin/admin-panel/queues', 'admin-panel', {
    label: 'REAL',
    i18n: 'PASS',
    menu: menu('queues', 'platform-infrastructure', 'platformAdmin.menuQueues', 'queues', 'platform-admin/system-admin', '队列'),
  }),
  detailAction('/platform-admin/admin-panel/queue/:queueName', 'admin-panel', {
    label: 'REAL',
    i18n: 'PASS',
    parentPath: '/platform-admin/admin-panel/queues',
    fixtureStrategy: 'PLATFORM_QUEUE_FIXTURE',
  }),
  canonical('/platform-admin/admin-panel/cron-jobs', 'admin-panel', {
    label: 'REAL',
    i18n: 'PASS',
    menu: menu('cron-jobs', 'platform-infrastructure', 'platformAdmin.menuCronJobs', 'cron', 'platform-admin/system-admin', 'Cron Jobs'),
  }),
  canonical('/platform-admin/admin-panel/logs', 'admin-panel', {
    label: 'REAL',
    i18n: 'PASS',
    menu: menu('system-logs', 'platform-infrastructure', 'platformAdmin.menuSystemLogs', 'logs', 'platform-admin/system-admin', '系统日志'),
  }),

  hidden('/platform-admin/batch-jobs', 'execution-log', {
    label: 'REAL',
    i18n: 'PASS',
    tenantScope: 'EXPLICIT_WORKSPACE',
    reason: 'The DB+BullMQ support tool is fully workspace-scoped but intentionally hidden from the primary operations menu.',
    exitCriteria: 'PAR-120 remains hidden; promote only after product ownership explicitly makes batch support a routine Platform Admin workflow.',
    evidence: ['platform-admin-route-readiness-v1/requirements.md§3.3', 'PAR-120'],
  }),
  hidden('/platform-admin/batch-jobs/:id', 'execution-log', {
    label: 'REAL',
    i18n: 'PASS',
    tenantScope: 'EXPLICIT_WORKSPACE',
    reason: 'The compound workspace+job detail belongs to the registered hidden batch support workflow.',
    exitCriteria: 'PAR-120 follows the list route if product ownership promotes or retires the batch support workflow.',
    evidence: ['platform-admin-route-readiness-v1/requirements.md§3.3', 'PAR-120'],
  }),
  retired('/platform-admin/governor-limits', 'admin-panel', {
    reason: 'Request-local AsyncLocalStorage counters are enforcement state, not a historical platform metric owner; exposing them as a platform dashboard is misleading.',
    exitCriteria: 'A future spec may introduce a permission-aware historical metric owner and register a new route; the retired API/UI must not be re-enabled in place.',
    evidence: ['platform-admin-route-readiness-v1/requirements.md§3.2', 'PAR-055', 'PAR-121'],
  }),
  hidden('/platform-admin/query-monitor', 'admin-panel', {
    label: 'REAL',
    i18n: 'PASS',
    tenantScope: 'EXPLICIT_WORKSPACE',
    reason: 'Attributed and redacted slow-query data is a sensitive support tool, so it remains intentionally hidden from routine navigation.',
    exitCriteria: 'PAR-122 remains hidden; promote only with an explicit discoverability decision and renewed security review of redaction evidence.',
    evidence: ['platform-admin-route-readiness-v1/requirements.md§3.3', 'PAR-122'],
  }),
  hidden('/platform-admin/query-monitor/:id', 'admin-panel', {
    label: 'REAL',
    i18n: 'PASS',
    tenantScope: 'EXPLICIT_WORKSPACE',
    reason: 'The compound workspace+query detail is part of the registered hidden sensitive support workflow.',
    exitCriteria: 'PAR-122 follows the list route after an explicit discoverability and security decision.',
    evidence: ['platform-admin-route-readiness-v1/requirements.md§3.3', 'PAR-122'],
  }),

  ...LEGACY_ROUTE_DEFINITIONS.map(legacyRedirect),
];

const registryByPath = new Map(
  PLATFORM_ADMIN_ROUTE_READINESS.map((entry) => [entry.path, entry] as const),
);

export const getPlatformAdminRouteReadiness = (
  path: string,
): PlatformAdminRouteReadinessEntry | undefined => registryByPath.get(path);

export const PLATFORM_ADMIN_ROUTE_PATHS: readonly string[] =
  PLATFORM_ADMIN_ROUTE_READINESS.map(({ path }) => path);

/** Active router declarations; retired inventory entries intentionally omit a route. */
export const PLATFORM_ADMIN_ACTIVE_ROUTE_PATHS: readonly string[] =
  PLATFORM_ADMIN_ROUTE_READINESS.filter(({ kind }) => kind !== 'RETIRED').map(
    ({ path }) => path,
  );

export const PLATFORM_ADMIN_MENU_ROUTES: readonly PlatformAdminMenuRouteEntry[] =
  PLATFORM_ADMIN_ROUTE_READINESS.filter(
    (entry): entry is PlatformAdminMenuRouteEntry =>
      entry.menu !== false,
  );

export const PLATFORM_ADMIN_MENU_ROUTE_PATHS: readonly string[] =
  PLATFORM_ADMIN_MENU_ROUTES.map(({ path }) => path);

export const ORG_ADMIN_ROUTE_ADOPTIONS: readonly {
  legacyPath: string;
  settingsPath: string;
  navigation: 'primary' | 'child' | 'experimental';
}[] = PLATFORM_ADMIN_ROUTE_READINESS.filter(
  (entry) => entry.kind === 'LEGACY_REDIRECT',
).map((entry) => ({
  legacyPath: entry.path,
  settingsPath: entry.target as string,
  navigation: entry.legacyNavigation as 'primary' | 'child' | 'experimental',
}));

export const WORKSPACE_OWNED_LEGACY_PLATFORM_ROUTE_PATHS: readonly string[] =
  ORG_ADMIN_ROUTE_ADOPTIONS.map(({ legacyPath }) => legacyPath);

export const PLATFORM_ADMIN_HIDDEN_EXCEPTIONS: readonly PlatformAdminRouteReadinessEntry[] =
  PLATFORM_ADMIN_ROUTE_READINESS.filter((entry) => entry.kind === 'REGISTERED_HIDDEN');

export const PLATFORM_ADMIN_CANONICAL_ROUTES: readonly PlatformAdminRouteReadinessEntry[] =
  PLATFORM_ADMIN_ROUTE_READINESS.filter(
    (entry) => entry.kind === 'CANONICAL' || entry.kind === 'DETAIL_ACTION',
  );

export const PLATFORM_ADMIN_GRAPHQL_OWNER_IDS: readonly Exclude<
  PlatformAdminRouteOwner,
  'navigation-boundary'
>[] = [...new Set(
  PLATFORM_ADMIN_CANONICAL_ROUTES.map((entry) => entry.owner),
)] as Exclude<PlatformAdminRouteOwner, 'navigation-boundary'>[];

export const PLATFORM_ADMIN_CANONICAL_GRAPHQL_OWNER_ROUTES: readonly {
  owner: Exclude<PlatformAdminRouteOwner, 'navigation-boundary'>;
  routes: readonly string[];
}[] = PLATFORM_ADMIN_GRAPHQL_OWNER_IDS.map((owner) => ({
  owner,
  routes: PLATFORM_ADMIN_CANONICAL_ROUTES
    .filter((entry) => entry.owner === owner)
    .map((entry) => entry.path),
}));

// Backwards-compatible names for callers migrated from the frontend-local
// registry. They are derived aliases, not independent inventories.
export type RouteKind = PlatformAdminRouteKind;
export type IntegrationLevel = PlatformAdminIntegrationLevel;
export type I18nLevel = PlatformAdminI18nLevel;
export type TenantScope = PlatformAdminTenantScope;
export type RouteException = PlatformAdminRouteException;
export const REGISTRY_PATHS = PLATFORM_ADMIN_ROUTE_PATHS;
export const REGISTRY_MENU_PATHS = PLATFORM_ADMIN_MENU_ROUTE_PATHS;
export const REGISTRY_LEGACY_TARGETS = ORG_ADMIN_ROUTE_ADOPTIONS.map(
  ({ legacyPath, settingsPath }) => ({ path: legacyPath, target: settingsPath }),
);
export const REGISTRY_HIDDEN_EXCEPTIONS = PLATFORM_ADMIN_HIDDEN_EXCEPTIONS;
export const getRouteReadiness = getPlatformAdminRouteReadiness;
