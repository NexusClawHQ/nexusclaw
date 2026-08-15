import { Injectable } from '@nestjs/common';

import type { ChatRequest, ModelConfig } from '../modules/agent-runtime/interfaces';
import {
  missingAutonomyPolicyDecision,
  unavailableKnowledgeContext,
  type AutonomyGateInput,
  type AutonomyGatePort,
  type BehaviorFeedbackPort,
  type ExecutionAdmissionPort,
  type ExecutionBudgetPolicyPort,
  type ExecutionUsageObservation,
  type ExecutionUsagePort,
  type ExecutorModelPort,
  type KnowledgeContextPort,
  type KnowledgeContextRequest,
  type RuntimeBehaviorEventPort,
} from '../modules/agent-runtime/contracts/runtime-boundary-ports';
import { COMMUNITY_CAPABILITY_CODES } from './community-capabilities';
import {
  unavailableVerifiedExemplars,
  type VerifiedExemplarPort,
  type VerifiedExemplarRequestV1,
} from '../modules/agent-runtime/contracts/verified-exemplar.port';
import {
  unavailableCuratedScenarioExemplars,
  type CuratedScenarioExemplarPort,
  type CuratedScenarioExemplarRequestV1,
} from '../modules/agent-runtime/contracts/curated-scenario-exemplar.port';
import {
  evaluateConservativeRagAuthorization,
  type RagAuthorizationPort,
  type RagAuthorizationInput,
} from '../modules/agent-permission/interfaces/rag-authorization.port';

@Injectable()
export class CommunityExecutionAdmissionAdapter
  implements ExecutionAdmissionPort
{
  assertExecutionAllowed(): void {
    // Community edition has no commercial license gate.
  }
}

@Injectable()
export class CommunityExecutionBudgetAdapter
  implements ExecutionBudgetPolicyPort, ExecutionUsagePort
{
  async preflight() {
    return { decision: 'allow' as const };
  }

  async checkIteration() {
    return { allowed: true as const };
  }

  async assertWithinOperationalBudget() {
    return { allowed: true as const };
  }

  async recordUsage(_observation: ExecutionUsageObservation): Promise<void> {
    // Local operational usage is represented by execution audit rows.
  }
}

@Injectable()
export class CommunityBehaviorUnavailableAdapter
  implements BehaviorFeedbackPort, RuntimeBehaviorEventPort
{
  async capture() {
    return {
      status: 'unavailable' as const,
      reasonCode:
        COMMUNITY_CAPABILITY_CODES.CAPABILITY_UNAVAILABLE_IN_COMMUNITY,
    };
  }
}

@Injectable()
export class CommunityAutonomyGateAdapter implements AutonomyGatePort {
  async evaluate(_input: AutonomyGateInput) {
    return missingAutonomyPolicyDecision();
  }
}

@Injectable()
export class CommunityKnowledgeUnavailableAdapter
  implements KnowledgeContextPort
{
  async load(_request: KnowledgeContextRequest) {
    return unavailableKnowledgeContext();
  }
}

@Injectable()
export class CommunityVerifiedExemplarUnavailableAdapter
  implements VerifiedExemplarPort
{
  async retrieve(_request: VerifiedExemplarRequestV1) {
    return unavailableVerifiedExemplars();
  }
}

@Injectable()
export class CommunityCuratedScenarioExemplarUnavailableAdapter
  implements CuratedScenarioExemplarPort
{
  async retrieve(_request: CuratedScenarioExemplarRequestV1) {
    return unavailableCuratedScenarioExemplars();
  }
}

@Injectable()
export class CommunityRagAuthorizationAdapter
  implements RagAuthorizationPort
{
  async authorize(input: RagAuthorizationInput) {
    return evaluateConservativeRagAuthorization(input);
  }
}

@Injectable()
export class CommunityModelProviderAdapter implements ExecutorModelPort {
  private readonly model: ModelConfig = {
    tier: 1,
    modelId: 'community-deterministic-smoke-v1',
    provider: 'community-local',
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    maxTokens: 4_096,
    supportsStreaming: false,
  };

  async chat(request: ChatRequest) {
    const lastContent = [...request.messages]
      .reverse()
      .map((message) => ('content' in message ? message.content : ''))
      .find((content) => typeof content === 'string' && content.trim()) ?? '';
    const content = request.responseFormat === 'json'
      ? JSON.stringify({
          thought: {
            reasoning: 'Deterministic Community smoke provider',
            plan: 'Return a local deterministic response without external inference',
            confidence: 1,
          },
          action: {
            type: 'finish',
            generatePrompt: `Community execution accepted: ${lastContent.slice(0, 160)}`,
          },
        })
      : 'Return a deterministic Community execution response.';
    return {
      content,
      model: this.model.modelId,
      inputTokens: Math.max(1, Math.ceil(lastContent.length / 4)),
      outputTokens: Math.max(1, Math.ceil(content.length / 4)),
      finishReason: 'stop',
      aiProviderStamp: {
        providerFamily: 'ai' as const,
        providerKind: this.model.provider,
        modelId: this.model.modelId,
        modelTier: 1,
        resolutionSource: 'community_deterministic_smoke',
      },
    };
  }

  selectModel(): ModelConfig {
    return this.model;
  }

  resolveCostModel(): ModelConfig {
    return this.model;
  }

  estimateCost(): number {
    return 0;
  }
}
