import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  Unique,
  BeforeInsert,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';
import { FieldMetadata } from './field-metadata.entity';
import { generateId } from '../../../common/utils/generate-id';
import type { ObjectLayoutConfig } from '../object-config/object-layout.schema';

@ObjectType()
export class IndexFieldMetadata {
  @Field(() => ID)
  id: string;

  @Field()
  fieldMetadataId: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field()
  order: number;
}

@ObjectType()
export class IndexMetadata {
  @Field(() => ID)
  id: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field()
  name: string;

  @Field({ nullable: true })
  indexWhereClause?: string;

  @Field({ nullable: true })
  indexType?: string;

  @Field()
  isUnique: boolean;

  @Field()
  isCustom: boolean;

  @Field(() => [IndexFieldMetadata])
  indexFieldMetadatas: IndexFieldMetadata[];
}

@ObjectType()
export class IndexMetadataEdge {
  @Field(() => IndexMetadata)
  node: IndexMetadata;

  @Field()
  cursor: string;
}

@ObjectType()
export class IndexMetadataConnection {
  @Field(() => [IndexMetadataEdge])
  edges: IndexMetadataEdge[];
}

@ObjectType()
export class FieldMetadataEdge {
  @Field(() => FieldMetadata)
  node: FieldMetadata;

  @Field()
  cursor: string;
}

@ObjectType()
export class FieldMetadataPageInfo {
  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;

  @Field(() => String, { nullable: true })
  startCursor: string | null;

  @Field(() => String, { nullable: true })
  endCursor: string | null;
}

@ObjectType()
export class FieldMetadataConnection {
  @Field(() => [FieldMetadataEdge])
  edges: FieldMetadataEdge[];

  @Field(() => FieldMetadataPageInfo)
  pageInfo: FieldMetadataPageInfo;
}

@ObjectType('Object')
@Entity('object_metadata')
@Unique('UQ_object_metadata_workspace_name', ['workspaceId', 'nameSingular'])
export class ObjectMetadata {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Field()
  @Column()
  nameSingular: string;

  @Field()
  @Column()
  namePlural: string;

  @Field()
  @Column()
  labelSingular: string;

  @Field()
  @Column()
  labelPlural: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  description?: string;

  /** User-facing help text for the object (Req 2). */
  @Field({ nullable: true })
  @Column({ nullable: true })
  helpText?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  icon?: string;

  @Field()
  @Column({ default: false })
  isCustom: boolean;

  @Field()
  @Column({ default: false })
  isRemote: boolean;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field()
  @Column({ default: false })
  isSystem: boolean;

  @Field()
  @Column({ name: 'contains_pii', type: 'boolean', default: false })
  containsPii: boolean;

  @Field()
  @Column({ default: true })
  isSearchable: boolean;

  /** Deployment status (Req 9.1). 'in_development' objects are hidden from end users. */
  @Field()
  @Column({ name: 'deployment_status', type: 'varchar', length: 16, default: 'deployed' })
  deploymentStatus: 'in_development' | 'deployed';

  /** Object-level capability toggles (Req 9.2); default true preserves behavior. */
  @Field()
  @Column({ name: 'allow_activities', type: 'boolean', default: true })
  allowActivities: boolean;

  @Field()
  @Column({ name: 'allow_reports', type: 'boolean', default: true })
  allowReports: boolean;

  @Field()
  @Column({ name: 'allow_search', type: 'boolean', default: true })
  allowSearch: boolean;

  @Field({ nullable: true })
  @Column({ nullable: true })
  labelIdentifierFieldMetadataId?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  imageIdentifierFieldMetadataId?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  shortcut?: string;

  /** Auto-number record-name display format, e.g. "INV-{0000}" (Req 8). */
  @Field({ nullable: true })
  @Column({ name: 'record_name_format', nullable: true })
  recordNameFormat?: string;

  /** First number for auto-number record names (default 1). */
  @Field({ nullable: true })
  @Column({ name: 'record_name_starting_number', type: 'int', nullable: true })
  recordNameStartingNumber?: number;

  /**
   * Typed object layout config — Search Layout + Field Sets (Req 9.4). Validated
   * by ObjectLayoutConfigSchema on write; read via readObjectLayoutConfig.
   * Compact Layout keeps its dedicated page-builder entity.
   */
  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ name: 'layout_config', type: 'jsonb', nullable: true })
  layoutConfig?: ObjectLayoutConfig;

  @Field()
  @Column({ default: true })
  isLabelSyncedWithName: boolean;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 5, nullable: true, unique: true })
  keyPrefix?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  translations?: Record<string, {
    labelSingular?: string;
    labelPlural?: string;
    description?: string;
  }>;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, unknown>;

  @OneToMany(() => FieldMetadata, (field) => field.object, { eager: true })
  fieldsRaw: FieldMetadata[];

  @Field(() => FieldMetadataConnection)
  fields: FieldMetadataConnection;

  @Field(() => IndexMetadataConnection)
  indexMetadatas: IndexMetadataConnection;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
