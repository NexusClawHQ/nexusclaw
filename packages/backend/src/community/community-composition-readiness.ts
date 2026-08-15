import { COMMUNITY_ENTITY_MANIFEST } from './community-entity-manifest';
import { COMMUNITY_MIGRATION_MANIFEST } from './community-migration-manifest';
import {
  COMMUNITY_CONTROLLER_MANIFEST,
  COMMUNITY_ENV_ALLOWLIST,
  COMMUNITY_FILESYSTEM_INPUT_ALLOWLIST,
  COMMUNITY_RESOLVER_MANIFEST,
} from './community-surface-manifests';

export const COMMUNITY_COMPOSITION_INCOMPLETE =
  'COMMUNITY_COMPOSITION_INCOMPLETE' as const;

export function assertCommunityCompositionReady(): void {
  const missing: string[] = [];
  if (COMMUNITY_ENTITY_MANIFEST.length === 0) missing.push('entity-manifest');
  if (COMMUNITY_MIGRATION_MANIFEST.length === 0) missing.push('migration-manifest');
  if (COMMUNITY_RESOLVER_MANIFEST.length === 0) missing.push('resolver-manifest');
  if (!Array.isArray(COMMUNITY_CONTROLLER_MANIFEST)) missing.push('controller-manifest');
  if (COMMUNITY_ENV_ALLOWLIST.required.length === 0) missing.push('env-allowlist');
  if (!Array.isArray(COMMUNITY_FILESYSTEM_INPUT_ALLOWLIST)) missing.push('filesystem-allowlist');
  if (missing.length > 0) {
    throw new Error(`${COMMUNITY_COMPOSITION_INCOMPLETE}:${missing.join(',')}`);
  }
}
