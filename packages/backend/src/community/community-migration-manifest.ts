import type { MigrationInterface } from 'typeorm';

import { CommunityBaseline1785000000000 } from './migrations/community-baseline-0001.generated';

export type CommunityMigrationConstructor = new () => MigrationInterface;

/**
 * Community publishes a reviewed baseline migration and public forward
 * migrations only. Private timestamp migration history is never filtered into
 * this list.
 */
export const COMMUNITY_MIGRATION_MANIFEST: readonly CommunityMigrationConstructor[] =
  Object.freeze([CommunityBaseline1785000000000]);
