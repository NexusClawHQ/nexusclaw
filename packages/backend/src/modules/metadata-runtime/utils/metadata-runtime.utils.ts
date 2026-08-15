import * as crypto from 'node:crypto';

import {
  type MetadataRuntimeField,
  type MetadataRuntimeObject,
  type MetadataRuntimeSnapshot,
} from '../contracts/metadata-runtime.types';
import {
  METADATA_RUNTIME_TAXONOMY_KINDS,
  getMetadataRuntimeComponentIdentity,
} from '../contracts/metadata-runtime-taxonomy';

type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike };

function sortValue(value: unknown): JsonLike {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === 'object') {
    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortValue(entry)] as const);

    return Object.fromEntries(sortedEntries);
  }

  return String(value);
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value), null, 2);
}

export function hashMetadataRuntimeContent(content: string): string {
  let payload = content;
  try {
    const normalize = (value: unknown, parentKey?: string): unknown => {
      if (Array.isArray(value)) {
        return value.map((entry) => normalize(entry, parentKey));
      }
      if (value && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>)
          .sort((left, right) => left.localeCompare(right))
          .reduce<Record<string, unknown>>((result, key) => {
            result[key] = normalize((value as Record<string, unknown>)[key], key);
            return result;
          }, {});
      }
      if (
        typeof value === 'string'
        && (parentKey === 'nameSingular' || parentKey === 'objectNameSingular')
      ) {
        return value.toLocaleLowerCase('en-US');
      }
      return value;
    };
    payload = JSON.stringify(normalize(JSON.parse(content)));
  } catch {
    // Non-JSON runtime artifacts retain their byte-level hash contract.
  }
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function sortMetadataRuntimeSnapshot(
  snapshot: MetadataRuntimeSnapshot,
): MetadataRuntimeSnapshot {
  const sortedObjects = [...snapshot.objects]
    .map((objectMetadata) => ({
      ...objectMetadata,
      fields: [...objectMetadata.fields].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    }))
    .sort((left, right) => left.nameSingular.localeCompare(right.nameSingular));

  return {
    ...snapshot,
    objects: sortedObjects,
    ...Object.fromEntries(
      METADATA_RUNTIME_TAXONOMY_KINDS.map((kind) => {
        const components = Array.isArray(snapshot[kind]) ? [...snapshot[kind] as Record<string, unknown>[]] : undefined;
        if (!components) {
          return [kind, undefined];
        }

        components.sort((left, right) =>
          getMetadataRuntimeComponentIdentity(kind, left).localeCompare(
            getMetadataRuntimeComponentIdentity(kind, right),
          ),
        );

        return [kind, components];
      }),
    ),
  };
}

export function toIsoString(value?: Date | string): string | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : value;
}

export function normalizeFieldForDiff(field: MetadataRuntimeField): Record<string, unknown> {
  const relationDefinition =
    field.relationDefinition && typeof field.relationDefinition === 'object'
      ? field.relationDefinition as Record<string, unknown>
      : undefined;

  const normalizedRelation = relationDefinition
    ? {
        relationId: relationDefinition.relationId,
        direction: relationDefinition.direction,
        sourceObjectMetadata: relationDefinition.sourceObjectMetadata
          ? {
              nameSingular:
                (relationDefinition.sourceObjectMetadata as Record<string, unknown>).nameSingular,
              namePlural:
                (relationDefinition.sourceObjectMetadata as Record<string, unknown>).namePlural,
            }
          : undefined,
        targetObjectMetadata: relationDefinition.targetObjectMetadata
          ? {
              nameSingular:
                (relationDefinition.targetObjectMetadata as Record<string, unknown>).nameSingular,
              namePlural:
                (relationDefinition.targetObjectMetadata as Record<string, unknown>).namePlural,
            }
          : undefined,
        sourceFieldMetadata: relationDefinition.sourceFieldMetadata
          ? {
              name: (relationDefinition.sourceFieldMetadata as Record<string, unknown>).name,
            }
          : undefined,
        targetFieldMetadata: relationDefinition.targetFieldMetadata
          ? {
              name: (relationDefinition.targetFieldMetadata as Record<string, unknown>).name,
            }
          : undefined,
      }
    : undefined;

  const settings =
    field.settings && typeof field.settings === 'object'
      ? { ...field.settings }
      : field.settings;

  if (settings && typeof settings === 'object' && field.referenceHints?.rollup) {
    const normalizedSettings = settings as Record<string, unknown>;
    normalizedSettings.childObjectNameSingular =
      field.referenceHints.rollup.childObjectNameSingular;
    normalizedSettings.relationFieldName = field.referenceHints.rollup.relationFieldName;
    normalizedSettings.childFieldName = field.referenceHints.rollup.childFieldName;
    delete normalizedSettings.childObjectId;
    delete normalizedSettings.relationFieldId;
    delete normalizedSettings.childFieldId;
  }

  return {
    ...field,
    relationDefinition: normalizedRelation,
    settings,
  };
}

export function normalizeObjectForDiff(
  objectMetadata: MetadataRuntimeObject,
): Record<string, unknown> {
  return {
    ...objectMetadata,
    fields: objectMetadata.fields.map((field) => normalizeFieldForDiff(field)),
    labelIdentifierFieldName: objectMetadata.referenceHints?.labelIdentifierFieldName,
    imageIdentifierFieldName: objectMetadata.referenceHints?.imageIdentifierFieldName,
  };
}
