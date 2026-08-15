import { Injectable } from '@nestjs/common';

import { METADATA_RUNTIME_DEFAULT_DIFF_OPTIONS } from '../contracts/metadata-runtime.constants';
import {
  type MetadataRuntimeChange,
  type MetadataRuntimeDiff,
  type MetadataRuntimeDiffOptions,
  type MetadataRuntimeField,
  type MetadataRuntimeObject,
  type MetadataRuntimeSnapshot,
} from '../contracts/metadata-runtime.types';
import {
  getMetadataRuntimeComponentIdentity,
  METADATA_RUNTIME_TAXONOMY_KINDS,
  metadataRuntimeSingularKind,
  type MetadataRuntimeTaxonomyKind,
} from '../contracts/metadata-runtime-taxonomy';
import {
  normalizeFieldForDiff,
  normalizeObjectForDiff,
  stableStringify,
} from '../utils/metadata-runtime.utils';

function getPropertyChanges(
  beforeValue: Record<string, unknown> | undefined,
  afterValue: Record<string, unknown> | undefined,
  ignoreFields: string[],
): Array<{ property: string; before?: unknown; after?: unknown }> {
  const keys = new Set<string>([
    ...Object.keys(beforeValue ?? {}),
    ...Object.keys(afterValue ?? {}),
  ]);

  return Array.from(keys)
    .filter((key) => !ignoreFields.includes(key))
    .map((key) => ({
      property: key,
      before: beforeValue?.[key],
      after: afterValue?.[key],
    }))
    .filter((change) => stableStringify(change.before) !== stableStringify(change.after));
}

function indexSnapshot(snapshot: MetadataRuntimeSnapshot): {
  objects: Map<string, MetadataRuntimeObject>;
  fields: Map<string, MetadataRuntimeField>;
  taxonomy: Record<MetadataRuntimeTaxonomyKind, Map<string, Record<string, unknown>>>;
} {
  const objects = new Map<string, MetadataRuntimeObject>();
  const fields = new Map<string, MetadataRuntimeField>();
  const taxonomy = Object.fromEntries(
    METADATA_RUNTIME_TAXONOMY_KINDS.map((kind) => [kind, new Map<string, Record<string, unknown>>()])
  ) as Record<MetadataRuntimeTaxonomyKind, Map<string, Record<string, unknown>>>;

  for (const objectMetadata of snapshot.objects) {
    objects.set(objectMetadata.nameSingular, objectMetadata);

    for (const field of objectMetadata.fields) {
      fields.set(`${objectMetadata.nameSingular}.${field.name}`, field);
    }
  }

  for (const kind of METADATA_RUNTIME_TAXONOMY_KINDS) {
    for (const component of snapshot[kind] ?? []) {
      taxonomy[kind].set(
        getMetadataRuntimeComponentIdentity(kind, component),
        component,
      );
    }
  }

  return { objects, fields, taxonomy };
}

@Injectable()
export class MetadataDiffService {
  diffSnapshots(
    currentSnapshot: MetadataRuntimeSnapshot,
    targetSnapshot: MetadataRuntimeSnapshot,
    options?: MetadataRuntimeDiffOptions,
  ): MetadataRuntimeDiff {
    const resolvedOptions = {
      ...METADATA_RUNTIME_DEFAULT_DIFF_OPTIONS,
      ...options,
    };
    const current = indexSnapshot(currentSnapshot);
    const target = indexSnapshot(targetSnapshot);
    const changes: MetadataRuntimeChange[] = [];

    const objectNames = new Set([
      ...current.objects.keys(),
      ...target.objects.keys(),
    ]);

    for (const objectNameSingular of objectNames) {
      const beforeObject = current.objects.get(objectNameSingular);
      const afterObject = target.objects.get(objectNameSingular);

      if (!beforeObject && afterObject) {
        changes.push({
          kind: 'object',
          action: 'create',
          objectNameSingular,
          after: normalizeObjectForDiff(afterObject),
          propertyChanges: getPropertyChanges(
            undefined,
            normalizeObjectForDiff(afterObject),
            resolvedOptions.ignoreFields,
          ),
        });
        continue;
      }

      if (beforeObject && !afterObject) {
        changes.push({
          kind: 'object',
          action: 'delete',
          objectNameSingular,
          before: normalizeObjectForDiff(beforeObject),
          propertyChanges: getPropertyChanges(
            normalizeObjectForDiff(beforeObject),
            undefined,
            resolvedOptions.ignoreFields,
          ),
        });
        continue;
      }

      if (!beforeObject || !afterObject) {
        continue;
      }

      const normalizedBefore = normalizeObjectForDiff(beforeObject);
      const normalizedAfter = normalizeObjectForDiff(afterObject);
      const propertyChanges = getPropertyChanges(
        normalizedBefore,
        normalizedAfter,
        [...resolvedOptions.ignoreFields, 'fields'],
      );

      if (propertyChanges.length > 0) {
        changes.push({
          kind: 'object',
          action: 'update',
          objectNameSingular,
          before: normalizedBefore,
          after: normalizedAfter,
          propertyChanges,
        });
      }
    }

    const fieldNames = new Set([
      ...current.fields.keys(),
      ...target.fields.keys(),
    ]);

    for (const identity of fieldNames) {
      const [objectNameSingular, fieldName] = identity.split('.');
      const beforeField = current.fields.get(identity);
      const afterField = target.fields.get(identity);

      if (!beforeField && afterField) {
        changes.push({
          kind: 'field',
          action: 'create',
          objectNameSingular,
          fieldName,
          after: normalizeFieldForDiff(afterField),
          propertyChanges: getPropertyChanges(
            undefined,
            normalizeFieldForDiff(afterField),
            resolvedOptions.ignoreFields,
          ),
        });
        continue;
      }

      if (beforeField && !afterField) {
        changes.push({
          kind: 'field',
          action: 'delete',
          objectNameSingular,
          fieldName,
          before: normalizeFieldForDiff(beforeField),
          propertyChanges: getPropertyChanges(
            normalizeFieldForDiff(beforeField),
            undefined,
            resolvedOptions.ignoreFields,
          ),
        });
        continue;
      }

      if (!beforeField || !afterField) {
        continue;
      }

      const normalizedBefore = normalizeFieldForDiff(beforeField);
      const normalizedAfter = normalizeFieldForDiff(afterField);
      const propertyChanges = getPropertyChanges(
        normalizedBefore,
        normalizedAfter,
        resolvedOptions.ignoreFields,
      );

      if (propertyChanges.length > 0) {
        changes.push({
          kind: 'field',
          action: 'update',
          objectNameSingular,
          fieldName,
          before: normalizedBefore,
          after: normalizedAfter,
          propertyChanges,
        });
      }
    }

    const summary = {
      objects: {
        created: changes.filter((change) => change.kind === 'object' && change.action === 'create').length,
        updated: changes.filter((change) => change.kind === 'object' && change.action === 'update').length,
        deleted: changes.filter((change) => change.kind === 'object' && change.action === 'delete').length,
      },
      fields: {
        created: changes.filter((change) => change.kind === 'field' && change.action === 'create').length,
        updated: changes.filter((change) => change.kind === 'field' && change.action === 'update').length,
        deleted: changes.filter((change) => change.kind === 'field' && change.action === 'delete').length,
      },
      taxonomy: {},
    };

    for (const kind of METADATA_RUNTIME_TAXONOMY_KINDS) {
      const identities = new Set([
        ...current.taxonomy[kind].keys(),
        ...target.taxonomy[kind].keys(),
      ]);

      for (const identity of identities) {
        const beforeComponent = current.taxonomy[kind].get(identity);
        const afterComponent = target.taxonomy[kind].get(identity);

        if (!beforeComponent && afterComponent) {
          changes.push({
            kind,
            action: 'create',
            objectNameSingular: identity,
            componentIdentity: identity,
            after: afterComponent,
            propertyChanges: getPropertyChanges(undefined, afterComponent, resolvedOptions.ignoreFields),
          });
          continue;
        }

        if (beforeComponent && !afterComponent) {
          changes.push({
            kind,
            action: 'delete',
            objectNameSingular: identity,
            componentIdentity: identity,
            before: beforeComponent,
            propertyChanges: getPropertyChanges(beforeComponent, undefined, resolvedOptions.ignoreFields),
          });
          continue;
        }

        if (!beforeComponent || !afterComponent) {
          continue;
        }

        const propertyChanges = getPropertyChanges(
          beforeComponent,
          afterComponent,
          resolvedOptions.ignoreFields,
        );

        if (propertyChanges.length > 0) {
          changes.push({
            kind,
            action: 'update',
            objectNameSingular: identity,
            componentIdentity: identity,
            before: beforeComponent,
            after: afterComponent,
            propertyChanges,
          });
        }
      }

      const taxonomySummary = summary.taxonomy as any;
      taxonomySummary[kind] = {
        created: changes.filter((change) => change.kind === kind && change.action === 'create').length,
        updated: changes.filter((change) => change.kind === kind && change.action === 'update').length,
        deleted: changes.filter((change) => change.kind === kind && change.action === 'delete').length,
      };
    }

    const humanSummary = changes.map((change) => {
      const target = change.componentIdentity
        ? change.componentIdentity
        : change.kind === 'object'
        ? change.objectNameSingular
        : `${change.objectNameSingular}.${change.fieldName}`;
      const kindLabel = change.kind === 'object' || change.kind === 'field'
        ? change.kind
        : metadataRuntimeSingularKind(change.kind as MetadataRuntimeTaxonomyKind);

      return `${change.action.toUpperCase()} ${kindLabel} ${target}`;
    });

    return {
      baseline: resolvedOptions.baseline,
      changes,
      summary,
      humanSummary,
    };
  }
}
