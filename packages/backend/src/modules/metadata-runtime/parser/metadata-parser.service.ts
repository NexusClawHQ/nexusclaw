import { Injectable } from '@nestjs/common';

import {
  METADATA_RUNTIME_SCHEMA_VERSION,
  type MetadataRuntimeDiagnostic,
  type MetadataRuntimeField,
  type MetadataRuntimeFieldFile,
  type MetadataRuntimeLoadedFile,
  type MetadataRuntimeObject,
  type MetadataRuntimeObjectFile,
  type MetadataRuntimeSnapshot,
} from '../contracts/metadata-runtime.types';
import {
  isMetadataRuntimeFieldFile,
  normalizeMetadataRuntimeFilePath,
} from '../contracts/metadata-runtime-paths';
import {
  getMetadataRuntimeEnvelopePayload,
  inferMetadataRuntimeTaxonomyKind,
  isMetadataRuntimeTaxonomyKind,
  METADATA_RUNTIME_TAXONOMY_KINDS,
  metadataRuntimeSingularKind,
  type MetadataRuntimeTaxonomyKind,
} from '../contracts/metadata-runtime-taxonomy';

interface MutableObjectDefinition {
  object?: MetadataRuntimeObject;
  fields: Map<string, MetadataRuntimeField>;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

@Injectable()
export class MetadataParserService {
  parseFiles(files: MetadataRuntimeLoadedFile[]): {
    snapshot: MetadataRuntimeSnapshot;
    diagnostics: MetadataRuntimeDiagnostic[];
  } {
    const diagnostics: MetadataRuntimeDiagnostic[] = [];
    const objects = new Map<string, MutableObjectDefinition>();
    const taxonomy = Object.fromEntries(
      METADATA_RUNTIME_TAXONOMY_KINDS.map((kind) => [kind, [] as Record<string, unknown>[]]),
    ) as Record<MetadataRuntimeTaxonomyKind, Record<string, unknown>[]>;

    for (const file of files) {
      const normalizedPath = normalizeMetadataRuntimeFilePath(file.path);
      const document = file.document;

      if (!isRecord(document)) {
        diagnostics.push({
          code: 'METADATA_RUNTIME_INVALID_DOCUMENT',
          severity: 'error',
          message: 'Metadata file must parse into an object document',
          path: normalizedPath,
        });
        continue;
      }

      const envelope = this.validateDocumentEnvelope(normalizedPath, document, diagnostics);
      if (!envelope.valid) {
        continue;
      }

      if (isMetadataRuntimeFieldFile(normalizedPath) || envelope.kind === 'field') {
        this.consumeFieldDocument(normalizedPath, document, objects, diagnostics);
        continue;
      }

      if (envelope.taxonomyKind) {
        this.consumeTaxonomyDocument(normalizedPath, document, envelope.taxonomyKind, taxonomy, diagnostics);
        continue;
      }

      this.consumeObjectDocument(normalizedPath, document, objects, diagnostics);
    }

    const snapshotObjects = Array.from(objects.entries())
      .filter(([, entry]) => entry.object)
      .map(([objectNameSingular, entry]) => ({
        ...entry.object!,
        nameSingular: objectNameSingular,
        fields: Array.from(entry.fields.values()),
      }));

    for (const [objectNameSingular, entry] of objects.entries()) {
      if (!entry.object) {
        diagnostics.push({
          code: 'METADATA_RUNTIME_ORPHAN_FIELDS',
          severity: 'error',
          message: `Fields were provided for object "${objectNameSingular}" but no object definition exists`,
        });
      }
    }

    return {
      snapshot: {
        schemaVersion: METADATA_RUNTIME_SCHEMA_VERSION,
        objects: snapshotObjects,
        ...taxonomy,
      },
      diagnostics,
    };
  }

  private validateDocumentEnvelope(
    filePath: string,
    document: Record<string, unknown>,
    diagnostics: MetadataRuntimeDiagnostic[],
  ): {
    valid: boolean;
    kind: 'object' | 'field' | null;
    taxonomyKind: MetadataRuntimeTaxonomyKind | null;
  } {
    const schemaVersion =
      typeof document.schemaVersion === 'string' ? document.schemaVersion : undefined;
    if (schemaVersion && schemaVersion !== METADATA_RUNTIME_SCHEMA_VERSION) {
      diagnostics.push({
        code: 'METADATA_RUNTIME_SCHEMA_VERSION_UNSUPPORTED',
        severity: 'error',
        message:
          `Unsupported metadata runtime schemaVersion "${schemaVersion}", expected "${METADATA_RUNTIME_SCHEMA_VERSION}"`,
        path: filePath,
      });
      return { valid: false, kind: null, taxonomyKind: null };
    }

    if (!schemaVersion) {
      diagnostics.push({
        code: 'METADATA_RUNTIME_SCHEMA_VERSION_MISSING',
        severity: 'warning',
        message:
          `Metadata file "${filePath}" is missing schemaVersion; defaulting to "${METADATA_RUNTIME_SCHEMA_VERSION}" compatibility mode`,
        path: filePath,
      });
    }

    const declaredKind = typeof document.kind === 'string' ? document.kind : undefined;
    if (declaredKind && declaredKind !== 'object' && declaredKind !== 'field') {
      if (
        !isMetadataRuntimeTaxonomyKind(declaredKind)
        && !isMetadataRuntimeTaxonomyKind(`${declaredKind}s`)
      ) {
        diagnostics.push({
          code: 'METADATA_RUNTIME_KIND_UNSUPPORTED',
          severity: 'error',
          message: `Unsupported metadata runtime kind "${declaredKind}"`,
          path: filePath,
        });
        return { valid: false, kind: null, taxonomyKind: null };
      }
    }

    if (!declaredKind) {
      diagnostics.push({
        code: 'METADATA_RUNTIME_KIND_MISSING',
        severity: 'warning',
        message: `Metadata file "${filePath}" is missing kind; inferring from path`,
        path: filePath,
      });
      return {
        valid: true,
        kind: isMetadataRuntimeFieldFile(filePath) ? 'field' : null,
        taxonomyKind: inferMetadataRuntimeTaxonomyKind(filePath),
      };
    }

    const inferredKind = isMetadataRuntimeFieldFile(filePath) ? 'field' : 'object';
    if ((declaredKind === 'object' || declaredKind === 'field') && declaredKind !== inferredKind) {
      diagnostics.push({
        code: 'METADATA_RUNTIME_KIND_PATH_MISMATCH',
        severity: 'error',
        message:
          `Metadata file "${filePath}" declares kind "${declaredKind}" but its path implies "${inferredKind}"`,
        path: filePath,
      });
      return { valid: false, kind: null, taxonomyKind: null };
    }

    const taxonomyKind = declaredKind === 'object' || declaredKind === 'field'
      ? null
      : (isMetadataRuntimeTaxonomyKind(declaredKind)
        ? declaredKind
        : `${declaredKind}s` as MetadataRuntimeTaxonomyKind);

    return {
      valid: true,
      kind: declaredKind === 'object' || declaredKind === 'field' ? declaredKind : null,
      taxonomyKind,
    };
  }

  private consumeObjectDocument(
    filePath: string,
    document: Record<string, unknown>,
    objects: Map<string, MutableObjectDefinition>,
    diagnostics: MetadataRuntimeDiagnostic[],
  ): void {
    const objectDocument = (
      isRecord(document.object) ? document.object : document
    ) as unknown as MetadataRuntimeObjectFile['object'];
    const objectNameSingular =
      typeof objectDocument.nameSingular === 'string'
        ? objectDocument.nameSingular
        : undefined;

    if (!objectNameSingular) {
      diagnostics.push({
        code: 'METADATA_RUNTIME_OBJECT_NAME_MISSING',
        severity: 'error',
        message: 'Object definition must include nameSingular',
        path: filePath,
      });
      return;
    }

    const entry = objects.get(objectNameSingular) ?? { fields: new Map<string, MetadataRuntimeField>() };

    if (entry.object) {
      diagnostics.push({
        code: 'METADATA_RUNTIME_DUPLICATE_OBJECT',
        severity: 'error',
        message: `Duplicate object definition for "${objectNameSingular}"`,
        path: filePath,
      });
      return;
    }

    const fields = Array.isArray(objectDocument.fields)
      ? objectDocument.fields as MetadataRuntimeField[]
      : [];

    entry.object = {
      ...objectDocument,
      fields: [],
    };

    for (const field of fields) {
      if (!field?.name) {
        diagnostics.push({
          code: 'METADATA_RUNTIME_FIELD_NAME_MISSING',
          severity: 'error',
          message: `Object "${objectNameSingular}" contains a field without name`,
          path: filePath,
        });
        continue;
      }

      if (entry.fields.has(field.name)) {
        diagnostics.push({
          code: 'METADATA_RUNTIME_DUPLICATE_FIELD',
          severity: 'error',
          message: `Duplicate field definition "${objectNameSingular}.${field.name}"`,
          path: filePath,
        });
        continue;
      }

      entry.fields.set(field.name, field);
    }

    objects.set(objectNameSingular, entry);
  }

  private consumeFieldDocument(
    filePath: string,
    document: Record<string, unknown>,
    objects: Map<string, MutableObjectDefinition>,
    diagnostics: MetadataRuntimeDiagnostic[],
  ): void {
    const fieldDocument = (
      isRecord(document.field) ? document.field : document
    ) as unknown as MetadataRuntimeFieldFile['field'];
    const objectNameSingular = typeof document.objectNameSingular === 'string'
      ? document.objectNameSingular
      : this.inferObjectNameFromFieldPath(filePath);

    if (!objectNameSingular) {
      diagnostics.push({
        code: 'METADATA_RUNTIME_FIELD_OBJECT_MISSING',
        severity: 'error',
        message: 'Field document must include objectNameSingular or follow objects/<Object>/fields/* path',
        path: filePath,
      });
      return;
    }

    if (!fieldDocument?.name) {
      diagnostics.push({
        code: 'METADATA_RUNTIME_FIELD_NAME_MISSING',
        severity: 'error',
        message: 'Field definition must include name',
        path: filePath,
      });
      return;
    }

    const entry = objects.get(objectNameSingular) ?? { fields: new Map<string, MetadataRuntimeField>() };

    if (entry.fields.has(fieldDocument.name)) {
      diagnostics.push({
        code: 'METADATA_RUNTIME_DUPLICATE_FIELD',
        severity: 'error',
        message: `Duplicate field definition "${objectNameSingular}.${fieldDocument.name}"`,
        path: filePath,
      });
      return;
    }

    entry.fields.set(fieldDocument.name, this.normalizeLegacyRelationField(fieldDocument));
    objects.set(objectNameSingular, entry);
  }

  /**
   * Legacy package payloads describe relation fields as
   * `relation: { targetObject, type }` while the runtime contract requires
   * `relationDefinition` with `direction` and `targetObjectMetadata.nameSingular`
   * (applySnapshot resolves the target id by nameSingular). Mirror the export
   * side's legacy support so package installs accept both shapes; fields that
   * are not legacy RELATION fields pass through untouched.
   */
  private normalizeLegacyRelationField(field: MetadataRuntimeField): MetadataRuntimeField {
    if (field.type !== 'RELATION' || field.relationDefinition) {
      return field;
    }
    const legacyRelation = asRecord(
      (field as unknown as Record<string, unknown>).relation,
    );
    const direction = typeof legacyRelation?.type === 'string' ? legacyRelation.type : undefined;
    const targetObject = typeof legacyRelation?.targetObject === 'string'
      ? legacyRelation.targetObject
      : undefined;
    if (!direction || !targetObject) {
      return field;
    }
    const normalized: MetadataRuntimeField = {
      ...field,
      relationDefinition: {
        direction,
        targetObjectMetadata: { nameSingular: targetObject },
      },
    };
    delete (normalized as unknown as Record<string, unknown>).relation;
    return normalized;
  }

  private inferObjectNameFromFieldPath(filePath: string): string | undefined {
    const segments = normalizeMetadataRuntimeFilePath(filePath).split('/');
    const objectsIndex = segments.indexOf('objects');

    if (objectsIndex === -1 || objectsIndex + 1 >= segments.length) {
      return undefined;
    }

    return segments[objectsIndex + 1];
  }

  private consumeTaxonomyDocument(
    filePath: string,
    document: Record<string, unknown>,
    kind: MetadataRuntimeTaxonomyKind,
    taxonomy: Record<MetadataRuntimeTaxonomyKind, Record<string, unknown>[]>,
    diagnostics: MetadataRuntimeDiagnostic[],
  ): void {
    const payload = getMetadataRuntimeEnvelopePayload(document, kind);
    if (!payload) {
      diagnostics.push({
        code: 'METADATA_RUNTIME_COMPONENT_PAYLOAD_MISSING',
        severity: 'error',
        message: `Metadata file "${filePath}" must include a ${metadataRuntimeSingularKind(kind)} payload`,
        path: filePath,
      });
      return;
    }

    taxonomy[kind].push(payload);
  }
}
