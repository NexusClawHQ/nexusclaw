import {
  canonicalJsonDigest,
  type Sha256Digest,
} from './canonical-hash';
import {
  cloneJsonValue,
  isJsonValue,
  type JsonObject,
  type JsonValue,
} from './json-value';
import type {
  FlowInputMappingV2,
  FlowRevisionIdentityV1,
} from './flow-payload-v2.types';

/**
 * The content-addressed Flow definition shape frozen by design §5.3/§10.3.
 * Display names, database ids, timestamps and lifecycle status are excluded.
 */
export interface FlowRevisionDefinitionV2 {
  readonly trigger: JsonObject | null;
  readonly nodes: ReadonlyArray<JsonObject>;
  readonly edges: ReadonlyArray<JsonObject>;
}

/** Parse and canonicalize one non-root RFC 6901 JSON Pointer. */
export function canonicalizeFlowJsonPointer(pointer: string): {
  readonly pointer: string;
  readonly segments: ReadonlyArray<string>;
} {
  if (
    typeof pointer !== 'string' ||
    !pointer.startsWith('/') ||
    pointer === '/'
  ) {
    throw new Error('FLOW_ACTION_MAPPING_POINTER_INVALID');
  }

  const segments = pointer.slice(1).split('/').map((segment) => {
    if (/~(?![01])/u.test(segment)) {
      throw new Error('FLOW_ACTION_MAPPING_POINTER_INVALID');
    }
    return segment.replace(/~1/gu, '/').replace(/~0/gu, '~');
  });
  const canonical = `/${segments
    .map((segment) => segment.replace(/~/gu, '~0').replace(/\//gu, '~1'))
    .join('/')}`;
  return { pointer: canonical, segments };
}

/**
 * Normalize and sort mappings by canonical pointer UTF-8 byte order. Duplicate
 * targets and ancestor/descendant targets are rejected after pointer unescape.
 */
export function normalizeFlowInputMappings(
  mappings: ReadonlyArray<FlowInputMappingV2>,
): FlowInputMappingV2[] {
  const normalized = mappings.map((mapping) => {
    const target = canonicalizeFlowJsonPointer(mapping.targetJsonPointer);
    return {
      mapping: {
        targetJsonPointer: target.pointer,
        source: cloneJsonValue(mapping.source as unknown as JsonValue),
      } as FlowInputMappingV2,
      segments: target.segments,
    };
  });

  normalized.sort((left, right) =>
    compareUtf8(left.mapping.targetJsonPointer, right.mapping.targetJsonPointer),
  );
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1]!.segments;
    const current = normalized[index]!.segments;
    if (
      isPointerPrefix(previous, current) ||
      isPointerPrefix(current, previous)
    ) {
      throw new Error('FLOW_ACTION_MAPPING_TARGET_OVERLAP');
    }
  }
  return normalized.map(({ mapping }) => mapping);
}

/** Build the mapped JSON object in the same canonical order used for hashing. */
export function buildCanonicalFlowMappedInput(
  mappings: ReadonlyArray<FlowInputMappingV2>,
  resolveContextPath: (path: string) => unknown,
): JsonObject {
  const output: JsonObject = {};
  for (const mapping of normalizeFlowInputMappings(mappings)) {
    const value =
      mapping.source.kind === 'literal'
        ? mapping.source.value
        : resolveContextPath(mapping.source.path);
    if (!isJsonValue(value)) {
      throw new Error('FLOW_ACTION_MAPPING_VALUE_NOT_JSON');
    }
    const { segments } = canonicalizeFlowJsonPointer(
      mapping.targetJsonPointer,
    );
    setJsonPointer(output, segments, cloneJsonValue(value));
  }
  return output;
}

/**
 * Normalize the immutable Flow definition. Nodes and edges are set-like at
 * this level; explicitly ordered arrays inside settings retain their order,
 * except INVOKE_UNIT inputMappings which have their own canonical order.
 */
export function normalizeFlowRevisionDefinition(
  definition: FlowRevisionDefinitionV2,
): FlowRevisionDefinitionV2 {
  if (!isJsonValue(definition as unknown)) {
    throw new Error('FLOW_DEFINITION_NOT_JSON');
  }

  const nodes = definition.nodes
    .map((node) => normalizeFlowNode(node))
    .sort((left, right) =>
      compareUtf8(readRequiredString(left, 'id'), readRequiredString(right, 'id')),
    );
  const edges = definition.edges
    .map((edge) => cloneJsonValue(edge) as JsonObject)
    .sort(compareFlowEdges);

  return {
    trigger:
      definition.trigger === null
        ? null
        : (cloneJsonValue(definition.trigger) as JsonObject),
    nodes,
    edges,
  };
}

/** Compute both frozen Flow hashes from one normalized definition. */
export function computeFlowRevisionIdentity(
  flowApiName: string,
  definition: FlowRevisionDefinitionV2,
): FlowRevisionIdentityV1 & {
  readonly normalizedDefinition: FlowRevisionDefinitionV2;
} {
  if (typeof flowApiName !== 'string' || flowApiName.trim() === '') {
    throw new Error('FLOW_API_NAME_REQUIRED');
  }
  const normalizedDefinition = normalizeFlowRevisionDefinition(definition);
  const definitionHash = canonicalJsonDigest(
    normalizedDefinition as unknown as JsonValue,
  );
  const flowRevisionKey = canonicalJsonDigest({
    flowApiName,
    definitionHash,
    normalizedDefinition,
  } as unknown as JsonValue);
  return {
    flowApiName,
    flowRevisionKey: flowRevisionKey as Sha256Digest,
    definitionHash: definitionHash as Sha256Digest,
    normalizedDefinition,
  };
}

function normalizeFlowNode(node: JsonObject): JsonObject {
  const normalized = cloneJsonValue(node) as JsonObject;
  const settings = normalized.settings;
  if (
    normalized.type === 'ACTION' &&
    settings &&
    typeof settings === 'object' &&
    !Array.isArray(settings) &&
    settings.actionType === 'INVOKE_UNIT'
  ) {
    const inputMappings = settings.inputMappings;
    if (!Array.isArray(inputMappings)) {
      throw new Error('FLOW_ACTION_INPUT_MAPPINGS_REQUIRED');
    }
    settings.inputMappings = normalizeFlowInputMappings(
      inputMappings as unknown as FlowInputMappingV2[],
    ) as unknown as JsonValue;
  }
  return normalized;
}

function compareFlowEdges(left: JsonObject, right: JsonObject): number {
  for (const key of ['source', 'sourceHandle', 'target', 'targetHandle', 'id']) {
    const comparison = compareUtf8(
      typeof left[key] === 'string' ? left[key] : '',
      typeof right[key] === 'string' ? right[key] : '',
    );
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function readRequiredString(value: JsonObject, key: string): string {
  const field = value[key];
  if (typeof field !== 'string' || field === '') {
    throw new Error(`FLOW_DEFINITION_${key.toUpperCase()}_REQUIRED`);
  }
  return field;
}

function isPointerPrefix(
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>,
): boolean {
  return (
    left.length <= right.length &&
    left.every((segment, index) => segment === right[index])
  );
}

function setJsonPointer(
  target: JsonObject,
  segments: ReadonlyArray<string>,
  value: JsonValue,
): void {
  let current = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    const next = current[segment];
    if (next === undefined) {
      current[segment] = {};
    } else if (
      next === null ||
      Array.isArray(next) ||
      typeof next !== 'object'
    ) {
      throw new Error('FLOW_ACTION_MAPPING_TARGET_OVERLAP');
    }
    current = current[segment] as JsonObject;
  }
  current[segments[segments.length - 1]!] = value;
}

function compareUtf8(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    if (leftBytes[index]! !== rightBytes[index]!) {
      return leftBytes[index]! - rightBytes[index]!;
    }
  }
  return leftBytes.length - rightBytes.length;
}
