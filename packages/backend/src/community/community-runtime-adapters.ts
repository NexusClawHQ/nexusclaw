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
import { evaluateConservativeRagAuthorization } from '../modules/agent-permission/interfaces/rag-authorization.port';
import type {
  RagAuthorizationPort,
  RagAuthorizationInput,
} from '../modules/agent-permission/interfaces/rag-authorization.port';
import {
  COMMUNITY_DEMO_CUSTOMER_ID,
  COMMUNITY_DEMO_LOOKUP_RESULT_MARKER,
  COMMUNITY_DEMO_SEND_RESULT_MARKER,
  COMMUNITY_DEMO_TOOL_LOOKUP,
  COMMUNITY_DEMO_TOOL_SEND_EMAIL,
} from './closed-loop/community-demo.constants';

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
      ? JSON.stringify(
          this.buildScenarioAction(lastContent, request.messages),
        )
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

  /**
   * Deterministic three-phase governed scenario. The phase is derived only
   * from RESULT MARKERS in the conversation transcript (never from tool
   * names — the executor enumerates allowed tool names in the system prompt
   * of every call, so names cannot distinguish phases):
   *   phase 1: call the L1 lookup tool (audited, proceeds)
   *   phase 2: call the L3 send tool (executor pauses for human approval)
   *   phase 3: finish with a summary (after the approved resume)
   */
  private buildScenarioAction(
    lastContent: string,
    messages: ChatRequest['messages'],
  ): Record<string, unknown> {
    const transcript = JSON.stringify(messages);
    const seenLookup = transcript.includes(COMMUNITY_DEMO_LOOKUP_RESULT_MARKER);
    const seenSend = transcript.includes(COMMUNITY_DEMO_SEND_RESULT_MARKER);
    const task = lastContent.slice(0, 160);

    const thought = (reasoning: string, plan: string) => ({
      reasoning,
      plan,
      confidence: 1,
    });

    if (!seenLookup) {
      return {
        thought: thought(
          'Deterministic scenario phase 1/3',
          'Look up the customer profile (L1 — audited, allowed to proceed)',
        ),
        action: {
          type: 'tool_call',
          toolName: COMMUNITY_DEMO_TOOL_LOOKUP,
          toolInput: {
            customerId: COMMUNITY_DEMO_CUSTOMER_ID,
            objectApiName: 'Contact',
          },
        },
      };
    }
    if (!seenSend) {
      return {
        thought: thought(
          'Deterministic scenario phase 2/3',
          'Draft the follow-up email (L3 — requires human approval before it can run)',
        ),
        action: {
          type: 'tool_call',
          toolName: COMMUNITY_DEMO_TOOL_SEND_EMAIL,
          toolInput: {
            customerId: COMMUNITY_DEMO_CUSTOMER_ID,
            objectApiName: 'Contact',
            subject: `Follow-up: ${task.slice(0, 60)}`,
            body: `Hi Acme Robotics team,\n\nFollowing up on our last conversation. Task context: ${task}\n\nBest regards,\nNexusClaw demo digital employee`,
          },
        },
      };
    }
    return {
      thought: thought(
        'Deterministic scenario phase 3/3',
        'Customer looked up and follow-up email dispatched under approval — finish',
      ),
      action: {
        type: 'finish',
        generatePrompt: `Governed demo run complete: customer ${COMMUNITY_DEMO_CUSTOMER_ID} looked up (L1 audited), follow-up email executed after human approval (L3). Original task: ${task}`,
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
