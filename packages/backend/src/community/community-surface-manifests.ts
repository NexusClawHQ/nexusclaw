import { CommunityAuthResolver } from './auth/community-auth.resolver';
import { CommunityAgentRuntimeResolver } from './runtime/community-agent-runtime.resolver';
import { CommunitySourceDisclosureController } from './source-disclosure/community-source-disclosure.module';

/** GraphQL owners reachable from the Community composition. */
export const COMMUNITY_RESOLVER_MANIFEST = Object.freeze([
  CommunityAuthResolver,
  CommunityAgentRuntimeResolver,
]);

/** Public REST surface is limited to the AGPL corresponding-source disclosure. */
export const COMMUNITY_CONTROLLER_MANIFEST: readonly Function[] = Object.freeze([
  CommunitySourceDisclosureController,
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
  optional: Object.freeze(['PORT', 'NODE_ENV']),
  sensitive: Object.freeze(['JWT_SECRET', 'DATABASE_URL', 'DATABASE_PASSWORD']),
});

/** Community runtime reads no host filesystem inputs. */
export const COMMUNITY_FILESYSTEM_INPUT_ALLOWLIST: readonly string[] = Object.freeze([]);
