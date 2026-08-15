import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { ObjectMetadata } from '../../modules/object-metadata/entities/object-metadata.entity';
import { FieldMetadata } from '../../modules/object-metadata/entities/field-metadata.entity';
import {
  METADATA_RUNTIME_SCHEMA_VERSION,
  type MetadataRuntimeDiagnostic,
  type MetadataRuntimeField,
  type MetadataRuntimeImportPlan,
  type MetadataRuntimeObject,
  type MetadataRuntimeSnapshot,
  type MetadataRuntimeSourceFile,
  type MetadataRuntimeValidationResult,
} from '../../modules/metadata-runtime/contracts/metadata-runtime.types';
import { METADATA_RUNTIME_TAXONOMY_KINDS } from '../../modules/metadata-runtime/contracts/metadata-runtime-taxonomy';
import { MetadataSourceFileLoaderService } from '../../modules/metadata-runtime/loader/metadata-source-file-loader.service';
import { MetadataParserService } from '../../modules/metadata-runtime/parser/metadata-parser.service';
import { MetadataDiffService } from '../../modules/metadata-runtime/diff/metadata-diff.service';
import {
  sortMetadataRuntimeSnapshot,
  toIsoString,
} from '../../modules/metadata-runtime/utils/metadata-runtime.utils';
import { unavailableCommunityCapability } from '../community-capabilities';

function projectField(field: FieldMetadata): MetadataRuntimeField {
  return {
    id: field.id,
    objectMetadataId: field.objectMetadataId,
    type: field.type,
    name: field.name,
    label: field.label,
    description: field.description,
    icon: field.icon,
    isCustom: field.isCustom,
    isActive: field.isActive,
    isSystem: field.isSystem,
    isNullable: field.isNullable,
    isUnique: field.isUnique,
    defaultValue: field.defaultValue,
    options: field.options,
    settings: field.settings,
    isLabelSyncedWithName: field.isLabelSyncedWithName,
    translations: field.translations,
    relationDefinition: field.relationDefinition as unknown as Record<string, unknown> | undefined,
    createdAt: toIsoString(field.createdAt),
    updatedAt: toIsoString(field.updatedAt),
  };
}

function projectObject(object: ObjectMetadata): MetadataRuntimeObject {
  const fieldById = new Map(
    (object.fieldsRaw ?? []).map((field) => [field.id, field]),
  );
  return {
    id: object.id,
    workspaceId: object.workspaceId,
    nameSingular: object.nameSingular,
    namePlural: object.namePlural,
    labelSingular: object.labelSingular,
    labelPlural: object.labelPlural,
    description: object.description,
    icon: object.icon,
    isCustom: object.isCustom,
    isRemote: object.isRemote,
    isActive: object.isActive,
    isSystem: object.isSystem,
    isSearchable: object.isSearchable,
    labelIdentifierFieldMetadataId: object.labelIdentifierFieldMetadataId,
    imageIdentifierFieldMetadataId: object.imageIdentifierFieldMetadataId,
    shortcut: object.shortcut,
    isLabelSyncedWithName: object.isLabelSyncedWithName,
    keyPrefix: object.keyPrefix,
    translations: object.translations,
    settings: object.settings,
    referenceHints: {
      labelIdentifierFieldName: object.labelIdentifierFieldMetadataId
        ? fieldById.get(object.labelIdentifierFieldMetadataId)?.name
        : undefined,
      imageIdentifierFieldName: object.imageIdentifierFieldMetadataId
        ? fieldById.get(object.imageIdentifierFieldMetadataId)?.name
        : undefined,
    },
    fields: (object.fieldsRaw ?? []).map(projectField),
    createdAt: toIsoString(object.createdAt),
    updatedAt: toIsoString(object.updatedAt),
  };
}

@Injectable()
export class CommunityMetadataRuntimeService {
  constructor(
    @InjectRepository(ObjectMetadata)
    private readonly objects: Repository<ObjectMetadata>,
    private readonly loader: MetadataSourceFileLoaderService,
    private readonly parser: MetadataParserService,
    private readonly diff: MetadataDiffService,
  ) {}

  async exportWorkspaceSnapshot(
    workspaceId: string,
  ): Promise<MetadataRuntimeSnapshot> {
    const objects = await this.objects.find({
      where: { workspaceId },
      order: { nameSingular: 'ASC' },
    });
    return sortMetadataRuntimeSnapshot({
      schemaVersion: METADATA_RUNTIME_SCHEMA_VERSION,
      workspaceId,
      metadata: { source: 'community.database' },
      objects: objects.map(projectObject),
    });
  }

  validateFiles(files: MetadataRuntimeSourceFile[]): {
    snapshot: MetadataRuntimeSnapshot;
    validation: MetadataRuntimeValidationResult;
  } {
    const loaded = this.loader.loadFromFiles(files);
    const parsed = this.parser.parseFiles(loaded.files);
    const diagnostics: MetadataRuntimeDiagnostic[] = [
      ...loaded.diagnostics,
      ...parsed.diagnostics,
    ];
    const objectNames = new Set<string>();

    for (const object of parsed.snapshot.objects) {
      if (!object.nameSingular || !object.namePlural) {
        diagnostics.push({
          code: 'METADATA_RUNTIME_OBJECT_IDENTITY_INCOMPLETE',
          severity: 'error',
          message: 'Community metadata objects require nameSingular and namePlural',
        });
      }
      if (objectNames.has(object.nameSingular)) {
        diagnostics.push({
          code: 'METADATA_RUNTIME_DUPLICATE_OBJECT',
          severity: 'error',
          message: `Duplicate object "${object.nameSingular}"`,
        });
      }
      objectNames.add(object.nameSingular);
      const fields = new Set<string>();
      for (const field of object.fields) {
        if (!field.name || !field.type) {
          diagnostics.push({
            code: 'METADATA_RUNTIME_FIELD_IDENTITY_INCOMPLETE',
            severity: 'error',
            message: `Object "${object.nameSingular}" has a field without name/type`,
          });
        }
        if (fields.has(field.name)) {
          diagnostics.push({
            code: 'METADATA_RUNTIME_DUPLICATE_FIELD',
            severity: 'error',
            message: `Duplicate field "${object.nameSingular}.${field.name}"`,
          });
        }
        fields.add(field.name);
        if (field.type === 'FORMULA' || field.type === 'ROLLUP') {
          diagnostics.push({
            code: 'CAPABILITY_UNAVAILABLE_IN_COMMUNITY',
            severity: 'error',
            message: `Community v0.1 cannot validate ${field.type} field "${object.nameSingular}.${field.name}"`,
          });
        }
      }
    }

    for (const kind of METADATA_RUNTIME_TAXONOMY_KINDS) {
      if ((parsed.snapshot[kind] ?? []).length > 0) {
        diagnostics.push({
          code: 'CAPABILITY_UNAVAILABLE_IN_COMMUNITY',
          severity: 'error',
          message: `Community v0.1 metadata taxonomy "${kind}" is unavailable`,
        });
      }
    }

    const validation = {
      valid: diagnostics.every((item) => item.severity !== 'error'),
      diagnostics,
      summary: diagnostics.map(
        (item) => `${item.severity.toUpperCase()}: ${item.message}`,
      ),
    };
    return { snapshot: sortMetadataRuntimeSnapshot(parsed.snapshot), validation };
  }

  async buildDryRunPlan(
    workspaceId: string,
    files: MetadataRuntimeSourceFile[],
  ): Promise<MetadataRuntimeImportPlan> {
    const current = await this.exportWorkspaceSnapshot(workspaceId);
    const { snapshot, validation } = this.validateFiles(files);
    snapshot.workspaceId = workspaceId;
    return {
      dryRun: true,
      destructiveSync: false,
      snapshot,
      validation,
      diff: this.diff.diffSnapshots(current, snapshot, { baseline: 'database' }),
    };
  }

  packageRegistryCapability() {
    return unavailableCommunityCapability('packageRegistryDeployment');
  }

  apply(): never {
    const unavailable = unavailableCommunityCapability('packageRegistryDeployment');
    throw new Error(`${unavailable.code}:${unavailable.capability}`);
  }
}
