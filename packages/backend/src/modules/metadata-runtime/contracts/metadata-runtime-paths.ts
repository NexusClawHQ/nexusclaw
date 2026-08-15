import * as path from 'node:path';

import {
  METADATA_RUNTIME_FIELD_FILE_SUFFIXES,
  METADATA_RUNTIME_OBJECT_FILE_SUFFIXES,
  METADATA_RUNTIME_TAXONOMY_FILE_SUFFIXES,
  METADATA_RUNTIME_TAXONOMY_SINGLETON_FILE_NAMES,
} from './metadata-runtime.constants';
import {
  type MetadataRuntimeFileFormat,
  type MetadataRuntimeLayout,
} from './metadata-runtime.types';
import {
  buildMetadataRuntimeTaxonomyFilePath,
  type MetadataRuntimeTaxonomyKind,
} from './metadata-runtime-taxonomy';

export function inferMetadataRuntimeFileFormat(filePath: string): MetadataRuntimeFileFormat {
  return filePath.endsWith('.json') ? 'json' : 'yaml';
}

export function isMetadataRuntimeObjectFile(filePath: string): boolean {
  return METADATA_RUNTIME_OBJECT_FILE_SUFFIXES.some((suffix) => filePath.endsWith(suffix)) ||
    path.basename(filePath) === 'object.json' ||
    path.basename(filePath) === 'object.yaml' ||
    path.basename(filePath) === 'object.yml';
}

export function isMetadataRuntimeFieldFile(filePath: string): boolean {
  return METADATA_RUNTIME_FIELD_FILE_SUFFIXES.some((suffix) => filePath.endsWith(suffix));
}

export function isMetadataRuntimeTaxonomyFile(filePath: string): boolean {
  return METADATA_RUNTIME_TAXONOMY_FILE_SUFFIXES.some((suffix) => filePath.endsWith(suffix)) ||
    METADATA_RUNTIME_TAXONOMY_SINGLETON_FILE_NAMES.includes(
      path.basename(filePath) as typeof METADATA_RUNTIME_TAXONOMY_SINGLETON_FILE_NAMES[number],
    );
}

export function isMetadataRuntimeSourceFile(filePath: string): boolean {
  return isMetadataRuntimeObjectFile(filePath) ||
    isMetadataRuntimeFieldFile(filePath) ||
    isMetadataRuntimeTaxonomyFile(filePath);
}

export function buildMetadataRuntimeObjectFilePath(
  objectNameSingular: string,
  format: MetadataRuntimeFileFormat,
  layout: MetadataRuntimeLayout,
): string {
  const extension = format === 'json' ? 'json' : 'yaml';

  if (layout === 'single-file') {
    return `objects/${objectNameSingular}.object.${extension}`;
  }

  return `objects/${objectNameSingular}/object.${extension}`;
}

export function buildMetadataRuntimeFieldFilePath(
  objectNameSingular: string,
  fieldName: string,
  format: MetadataRuntimeFileFormat,
): string {
  const extension = format === 'json' ? 'json' : 'yaml';

  return `objects/${objectNameSingular}/fields/${fieldName}.field.${extension}`;
}

export function buildMetadataRuntimeComponentFilePath(
  kind: MetadataRuntimeTaxonomyKind,
  payload: Record<string, unknown>,
  format: MetadataRuntimeFileFormat,
): string {
  return buildMetadataRuntimeTaxonomyFilePath(kind, payload, format);
}

export function normalizeMetadataRuntimeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.?\//, '');
}
