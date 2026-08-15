import { type MetadataRuntimeDiffOptions } from './metadata-runtime.types';

export const METADATA_RUNTIME_OBJECT_FILE_SUFFIXES = [
  '.object.json',
  '.object.yaml',
  '.object.yml',
] as const;

export const METADATA_RUNTIME_FIELD_FILE_SUFFIXES = [
  '.field.json',
  '.field.yaml',
  '.field.yml',
] as const;

export const METADATA_RUNTIME_TAXONOMY_FILE_SUFFIXES = [
  '.app.json',
  '.app.yaml',
  '.app.yml',
  '.relationship.json',
  '.relationship.yaml',
  '.relationship.yml',
  '.layout.json',
  '.layout.yaml',
  '.layout.yml',
  '.record-page.json',
  '.record-page.yaml',
  '.record-page.yml',
  '.view.json',
  '.view.yaml',
  '.view.yml',
  '.menu.json',
  '.menu.yaml',
  '.menu.yml',
  '.dashboard.json',
  '.dashboard.yaml',
  '.dashboard.yml',
  '.report.json',
  '.report.yaml',
  '.report.yml',
  '.report-folder.json',
  '.report-folder.yaml',
  '.report-folder.yml',
  '.action.json',
  '.action.yaml',
  '.action.yml',
  '.flow.json',
  '.flow.yaml',
  '.flow.yml',
  '.approval.json',
  '.approval.yaml',
  '.approval.yml',
  '.prompt.json',
  '.prompt.yaml',
  '.prompt.yml',
  '.agent.json',
  '.agent.yaml',
  '.agent.yml',
  '.permissionset.json',
  '.permissionset.yaml',
  '.permissionset.yml',
  '.permission.json',
  '.permission.yaml',
  '.permission.yml',
] as const;

export const METADATA_RUNTIME_TAXONOMY_SINGLETON_FILE_NAMES = [
  'role.json',
  'role.yaml',
  'role.yml',
  'permissionset.json',
  'permissionset.yaml',
  'permissionset.yml',
] as const;

export const METADATA_RUNTIME_DEFAULT_DIFF_OPTIONS: Required<MetadataRuntimeDiffOptions> = {
  baseline: 'snapshot',
  ignoreFields: [
    'id',
    'workspaceId',
    'createdAt',
    'updatedAt',
    'objectMetadataId',
    'labelIdentifierFieldMetadataId',
    'imageIdentifierFieldMetadataId',
  ],
};
