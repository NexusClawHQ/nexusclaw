import { parseMarkdownSections } from '@nexusclaw/shared/agent-markdown-policy';
import { createHash } from 'crypto';
import type { AgentDefinition, TopicDefinition } from '../../agent-builder/interfaces/agent-definition.interface';
import type {
  AgentExecutionContext,
  AuthorizedQueryConstraint,
} from '../interfaces';

export function composeReleaseBoundAgentPrompt(
  definition: AgentDefinition,
  selectedTopicIds?: readonly string[],
): string {
  const selected = selectedTopicIds?.length
    ? new Set(selectedTopicIds)
    : null;
  const topics = selected
    ? definition.topics.filter((topic) => selected.has(topic.id))
    : definition.topics;
  const blocks = [
    renderMarkdownBlock(definition.persona, '# 角色与语气'),
    renderMarkdownBlock(definition.identityPolicy, '# 身份策略'),
    renderMarkdownBlock(definition.systemInstructions, '# 工作总则'),
    composeTopics(topics, definition),
  ].filter((value) => value.trim().length > 0);
  return blocks.join('\n\n');
}

export function releaseBoundAllowedTools(
  definition: AgentDefinition,
  selectedTopicIds?: readonly string[],
): string[] {
  const bound = new Set(
    resolveReachableBindings(definition, selectedTopicIds)
      .map((binding) => binding.toolName.trim()),
  );
  const permitted = new Set(
    (definition.permissionConfig?.allowedTools ?? [])
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
  );
  const blocked = new Set(
    (definition.permissionConfig?.blockedTools ?? [])
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
  );
  const selected =
    bound.size > 0 && permitted.size > 0
      ? [...bound].filter((toolName) => permitted.has(toolName))
      : bound.size > 0
        ? [...bound]
        : [...permitted];
  return [...new Set(selected)]
    .filter((toolName) => !blocked.has(toolName))
    .sort();
}

export function selectReleaseBoundTopicIds(
  definition: AgentDefinition,
  userInput: string,
  routedCapabilityCode?: string | null,
): string[] {
  // Formal dispatch already resolved a package-owned capability code such as
  // `namespace.agent.followup_update`. Its final segment is the immutable
  // AgentVersion topic id and therefore outranks fuzzy natural-language
  // matching. This is metadata-driven and introduces no industry heuristic.
  const routedTopicId = routedCapabilityCode?.trim().split('.').filter(Boolean).at(-1);
  if (
    routedTopicId &&
    definition.topics.some((topic) => topic.id === routedTopicId)
  ) {
    return [routedTopicId];
  }

  const queryTokens = semanticTokens(userInput);
  if (queryTokens.size === 0) return [];
  const scored = definition.topics.map((topic) => {
    const corpus = [
      topic.id,
      topic.name,
      topic.description,
      ...(topic.instructions ?? []).map((item) => item.content),
    ].join(' ');
    const topicTokens = semanticTokens(corpus);
    let score = 0;
    for (const token of queryTokens) {
      if (topicTokens.has(token)) score += token.length >= 3 ? 3 : 1;
    }
    return { id: topic.id, score, priority: topic.priority ?? 0 };
  });
  const highest = Math.max(0, ...scored.map((item) => item.score));
  if (highest === 0) return [];
  return scored
    .filter((item) => item.score === highest)
    .sort((left, right) =>
      left.priority - right.priority || left.id.localeCompare(right.id),
    )
    .map((item) => item.id);
}

export function projectReleaseBoundContext(
  context: AgentExecutionContext,
  definition: AgentDefinition,
  selectedTopicIds: readonly string[],
): AgentExecutionContext {
  const model = definition.modelConfig;
  // Do NOT re-derive the cumulative ReAct execution budget
  // (`constraints.maxTokens`) from the frozen AgentVersion snapshot.
  // `buildContext` already computed it from the authoritative live Agent row
  // (modelConfig.maxTokensPerExecution, bounded to [1024, 128000] with a 16000
  // default). Re-deriving it here from the release snapshot silently downgrades
  // the budget whenever the live Agent row's maxTokensPerExecution was raised
  // after the version was frozen: the snapshot keeps the stale lower value, and
  // this projection overwrites the corrected budget (observed: A04 live row
  // 16000, active release v7 snapshot 12000 -> execution terminated with
  // "limit is 12000" even after the buildContext clamp was removed in 7a9af8bf).
  // The release snapshot remains the source of truth for *immutable behavior*
  // (prompt, tools, knowledge scope, guardrails, and the per-call output ceiling
  // maxOutputTokensPerStep) — but maxTokens is a resource limit that must follow
  // the live Agent row, exactly as buildContext already decided. This is the
  // same defect class as the buildContext clamp removed by 7a9af8bf.
  const maxTokens = context.constraints.maxTokens;
  const allowedKnowledge = new Set(definition.knowledgeBaseIds ?? []);
  const allowedSops = new Set(definition.sopDocumentIds ?? []);
  return {
    ...context,
    business: {
      ...context.business,
      queryAuthority: {
        structuredConstraints: compileStructuredQueryConstraints(definition),
        rankingHints: context.business?.queryAuthority?.rankingHints ?? [],
      },
    },
    knowledge: {
      relevantSOPs: context.knowledge.relevantSOPs.filter((item) =>
        allowedSops.has(item.id),
      ),
      domainKnowledge: context.knowledge.domainKnowledge.filter((item) =>
        allowedKnowledge.has(item.id),
      ),
      companyPolicies: context.knowledge.companyPolicies.filter((item) =>
        allowedKnowledge.has(item.id),
      ),
    },
    constraints: {
      ...context.constraints,
      maxTokens,
      maxOutputTokensPerStep: boundedInteger(
        model.maxTokens,
        context.constraints.maxOutputTokensPerStep ?? 2_048,
        128,
        Math.min(8_192, maxTokens),
      ),
      allowedTools: releaseBoundAllowedTools(
        definition,
        selectedTopicIds.length > 0 ? selectedTopicIds : undefined,
      ),
      guardrailRuleIds: [...(definition.guardrailRuleIds ?? [])],
    },
  };
}

export function compileStructuredQueryConstraints(
  definition: AgentDefinition,
): AuthorizedQueryConstraint[] {
  const constraints: AuthorizedQueryConstraint[] = [];
  for (const rule of definition.queryConstraintRules ?? []) {
    if (
      !rule.enabled ||
      !/^[A-Za-z0-9_.:-]{1,160}$/.test(rule.id) ||
      !Number.isInteger(rule.revision) ||
      rule.revision < 1 ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(rule.objectApiName)
    ) {
      continue;
    }
    const sourceRef = `query-rule:${rule.id}@${rule.revision}`;
    for (const predicate of rule.predicates ?? []) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(predicate.fieldApiName)) {
        continue;
      }
      const canonical = JSON.stringify({
        objectApiName: rule.objectApiName,
        fieldApiName: predicate.fieldApiName,
        operator: predicate.operator,
        value: predicate.value,
        sourceRef,
      });
      constraints.push({
        objectApiName: rule.objectApiName,
        fieldApiName: predicate.fieldApiName,
        operator: predicate.operator,
        value: predicate.value,
        source: 'structured_rule',
        sourceRef,
        digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
      });
    }
  }
  return constraints;
}

function resolveReachableBindings(
  definition: AgentDefinition,
  selectedTopicIds?: readonly string[],
) {
  const selected = selectedTopicIds?.length
    ? new Set(selectedTopicIds)
    : null;
  const bindings = new Map(
    (definition.toolBindings ?? []).map((binding) => [binding.id, binding]),
  );
  const resolved = [];
  const seen = new Set<string>();
  for (const topic of definition.topics ?? []) {
    if (selected && !selected.has(topic.id)) continue;
    for (const bindingId of topic.toolBindingIds ?? []) {
      const binding = bindings.get(bindingId);
      if (!binding || binding.topicId !== topic.id || !binding.toolName?.trim()) {
        throw new Error(
          `AGENT_VERSION_TOPIC_TOOL_BINDING_INVALID:${topic.id}:${bindingId}`,
        );
      }
      if (seen.has(binding.id)) {
        throw new Error(
          `AGENT_VERSION_TOPIC_TOOL_BINDING_DUPLICATE:${binding.id}`,
        );
      }
      seen.add(binding.id);
      resolved.push(binding);
    }
  }
  return resolved;
}

function renderMarkdownBlock(
  source: string | undefined,
  heading: string,
): string {
  if (!source?.trim()) return '';
  const sections = parseMarkdownSections(source);
  if (sections.length === 1 && sections[0].level === 0) {
    return `${heading}\n${sections[0].content}`;
  }
  const ordered = [
    ...sections
      .filter((section) => section.priorityTier === 'high')
      .sort((left, right) => left.order - right.order),
    ...sections
      .filter((section) => section.priorityTier === 'normal')
      .sort((left, right) => left.order - right.order),
  ];
  return `${heading}\n${ordered
    .map((section) =>
      section.title
        ? `${'#'.repeat(section.level + 1)} ${section.title}\n${section.content}`
        : section.content,
    )
    .join('\n\n')}`;
}

function composeTopics(
  topics: TopicDefinition[] | undefined,
  definition: AgentDefinition,
): string {
  const bindings = new Map(
    (definition.toolBindings ?? []).map((binding) => [binding.id, binding]),
  );
  return [...(topics ?? [])]
    .sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0))
    .map((topic) => {
      const instructions = [...(topic.instructions ?? [])]
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
        .map((instruction) => instruction.content?.trim())
        .filter((value): value is string => Boolean(value));
      if (!topic.name && instructions.length === 0) return '';
      return [
        `## ${topic.name || '主题'} (${topic.id})`,
        topic.description?.trim() ?? '',
        '主题说明和自然语言指令只用于理解、推荐与排序；不得据此添加排除性查询条件。只有当前用户明确提出的条件或运行时提供的结构化规则可以成为硬过滤。',
        `本主题只允许工具：${(topic.toolBindingIds ?? [])
          .map((id) => bindings.get(id)?.toolName)
          .filter(Boolean)
          .join(', ') || '无'}`,
        ...instructions.map((instruction) => `- ${instruction}`),
      ]
        .filter(Boolean)
        .join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

function semanticTokens(value: string): Set<string> {
  const normalized = value.toLowerCase();
  const tokens = new Set(
    normalized.match(/[a-z0-9_]+/g) ?? [],
  );
  for (const segment of normalized.match(/[\u3400-\u9fff]+/g) ?? []) {
    for (let index = 0; index < segment.length - 1; index += 1) {
      tokens.add(segment.slice(index, index + 2));
    }
  }
  return tokens;
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, Math.trunc(parsed)))
    : fallback;
}
