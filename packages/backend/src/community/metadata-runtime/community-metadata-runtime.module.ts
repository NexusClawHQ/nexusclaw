import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ObjectMetadata } from '../../modules/object-metadata/entities/object-metadata.entity';
import { FieldMetadata } from '../../modules/object-metadata/entities/field-metadata.entity';
import { MetadataSourceFileLoaderService } from '../../modules/metadata-runtime/loader/metadata-source-file-loader.service';
import { MetadataParserService } from '../../modules/metadata-runtime/parser/metadata-parser.service';
import { MetadataDiffService } from '../../modules/metadata-runtime/diff/metadata-diff.service';
import { CommunityMetadataRuntimeService } from './community-metadata-runtime.service';

@Module({
  imports: [TypeOrmModule.forFeature([ObjectMetadata, FieldMetadata])],
  providers: [
    MetadataSourceFileLoaderService,
    MetadataParserService,
    MetadataDiffService,
    CommunityMetadataRuntimeService,
  ],
  exports: [CommunityMetadataRuntimeService],
})
export class CommunityMetadataRuntimeModule {}
