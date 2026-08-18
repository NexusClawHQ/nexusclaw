/**
 * Single runtime truth for "which model source is this community instance
 * running on". Parsed once at boot from the environment; a partial BYO
 * configuration throws here, failing startup fast (fail-fast 防呆) instead of
 * silently degrading to the deterministic scenario.
 *
 * Consumed by the EXECUTOR_MODEL_PORT factory (adapter selection) and the
 * communityModelSource GraphQL query (console badge). Never exposes the API
 * key or the base URL — only the stable kind code and display-safe ids.
 */
import { Injectable } from '@nestjs/common';

import { CommunityModelProviderAdapter } from '../community-runtime-adapters';
import type { ExecutorModelPort } from '../../modules/agent-runtime/contracts/runtime-boundary-ports';
import {
  CommunityByoLlmModelProviderAdapter,
  nativeFetchLike,
} from './community-byo-llm.adapter';
import { parseCommunityByoLlmConfig } from './community-byo-llm.config';

export interface CommunityModelSourceView {
  /** Stable code — never a display string: 'deterministic_smoke' | 'byo_env'. */
  kind: 'deterministic_smoke' | 'byo_env';
  modelId: string;
  providerKind: string;
}

export const DETERMINISTIC_SMOKE_MODEL_ID = 'community-deterministic-smoke-v1';

@Injectable()
export class CommunityModelSourceService {
  readonly byoConfig = parseCommunityByoLlmConfig(process.env);

  view(): CommunityModelSourceView {
    return this.byoConfig
      ? {
          kind: 'byo_env',
          modelId: this.byoConfig.model,
          providerKind: this.byoConfig.providerKind,
        }
      : {
          kind: 'deterministic_smoke',
          modelId: DETERMINISTIC_SMOKE_MODEL_ID,
          providerKind: 'community-local',
        };
  }
}

/** EXECUTOR_MODEL_PORT factory: env decides which implementation is wired. */
export function createCommunityModelProvider(
  service: CommunityModelSourceService,
): ExecutorModelPort {
  return service.byoConfig
    ? new CommunityByoLlmModelProviderAdapter(
        service.byoConfig,
        nativeFetchLike,
      )
    : new CommunityModelProviderAdapter();
}
