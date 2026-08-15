import { Injectable } from '@nestjs/common';
import * as yaml from 'js-yaml';

import {
  type MetadataRuntimeDiagnostic,
  type MetadataRuntimeLoadedFile,
  type MetadataRuntimeSourceFile,
} from '../contracts/metadata-runtime.types';
import {
  inferMetadataRuntimeFileFormat,
  isMetadataRuntimeSourceFile,
  normalizeMetadataRuntimeFilePath,
} from '../contracts/metadata-runtime-paths';

/** Pure in-memory source owner used by Community; it never reads a path. */
@Injectable()
export class MetadataSourceFileLoaderService {
  loadFromFiles(files: MetadataRuntimeSourceFile[]): {
    files: MetadataRuntimeLoadedFile[];
    diagnostics: MetadataRuntimeDiagnostic[];
  } {
    const loadedFiles: MetadataRuntimeLoadedFile[] = [];
    const diagnostics: MetadataRuntimeDiagnostic[] = [];

    for (const file of files) {
      const normalizedPath = normalizeMetadataRuntimeFilePath(file.path);
      if (!isMetadataRuntimeSourceFile(normalizedPath)) {
        diagnostics.push({
          code: 'METADATA_RUNTIME_SOURCE_FILE_IGNORED',
          severity: 'warning',
          message:
            'File is outside the metadata-runtime JSON/YAML object, field, and taxonomy contract and was ignored',
          path: normalizedPath,
        });
        continue;
      }

      const format = inferMetadataRuntimeFileFormat(normalizedPath);
      try {
        const document = yaml.load(file.content);
        loadedFiles.push({
          path: normalizedPath,
          content: file.content,
          format,
          document,
        });
      } catch (error) {
        const yamlError = error as yaml.YAMLException;
        diagnostics.push({
          code: 'METADATA_RUNTIME_PARSE_ERROR',
          severity: 'error',
          message: yamlError.message,
          path: normalizedPath,
          line: yamlError.mark?.line != null ? yamlError.mark.line + 1 : undefined,
          column: yamlError.mark?.column != null ? yamlError.mark.column + 1 : undefined,
        });
      }
    }

    return { files: loadedFiles, diagnostics };
  }
}
