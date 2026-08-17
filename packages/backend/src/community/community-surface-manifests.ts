import { CommunityAuthResolver } from './auth/community-auth.resolver';
import { CommunityAgentRuntimeResolver } from './runtime/community-agent-runtime.resolver';
import { CommunityDemoConsoleController } from './closed-loop/community-demo-console.controller';
import { CommunitySourceDisclosureController } from './source-disclosure/community-source-disclosure.module';

/** GraphQL owners reachable from the Community composition. */
export const COMMUNITY_RESOLVER_MANIFEST = Object.freeze([
  CommunityAuthResolver,
  CommunityAgentRuntimeResolver,
]);

/**
 * Public REST surface: the source-transparency disclosure endpoint
 * plus the static demo console shell (its data access is fully guarded by
 * the GraphQL auth layer — the shell itself holds no secrets).
 */
export const COMMUNITY_CONTROLLER_MANIFEST: readonly Function[] = Object.freeze([
  CommunitySourceDisclosureController,
  CommunityDemoConsoleController,
]);

export const COMMUNITY_ENV_ALLOWLIST = Object.freeze({
  required: Object.freeze(['JWT_SECRET', 'COMMUNITY_SOURCE_URL']),
  database: Object.freeze([
    'DATABASE_URL',
    'DATABASE_HOST',
    'DATABASE_PORT',
    'DATABASE_USER',
    'DATABASE_PASSWORD',
    'DATABASE_NAME',
  ]),
  optional: Object.freeze(['PORT', 'NODE_ENV', 'COMMUNITY_DEMO_SEED']),
  sensitive: Object.freeze(['JWT_SECRET', 'DATABASE_URL', 'DATABASE_PASSWORD']),
});

/** Community runtime reads no host filesystem inputs. */
export const COMMUNITY_FILESYSTEM_INPUT_ALLOWLIST: readonly string[] = Object.freeze([]);
