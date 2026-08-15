import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';
import { generateId } from '../../../common/utils/generate-id';
import type { PiiClassification } from '../../../common/privacy/pii-classification';

// Forward reference to avoid circular dependency
@ObjectType()
export class RelationObjectMetadata {
  // External relation targets (for example user.roleId -> roles) do not have
  // an object_metadata row. Their stable name remains available, while an id
  // is only present for metadata-owned targets. Keep the TypeScript member
  // required for metadata-owned write inputs; GraphQL is the compatibility
  // boundary that permits the legacy external-target representation.
  @Field(() => ID, { nullable: true })
  id: string;

  @Field()
  nameSingular: string;

  @Field()
  namePlural: string;
}

@ObjectType()
export class RelationFieldMetadata {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;
}

@ObjectType()
export class RelationDefinition {
  @Field({ nullable: true })
  relationId?: string;

  @Field({ nullable: true })
  direction?: string;

  @Field(() => RelationObjectMetadata, { nullable: true })
  sourceObjectMetadata?: RelationObjectMetadata;

  @Field(() => RelationObjectMetadata, { nullable: true })
  targetObjectMetadata?: RelationObjectMetadata;

  @Field(() => RelationFieldMetadata, { nullable: true })
  sourceFieldMetadata?: RelationFieldMetadata;

  @Field(() => RelationFieldMetadata, { nullable: true })
  targetFieldMetadata?: RelationFieldMetadata;
}

@ObjectType('Field')
@Entity('field_metadata')
export class FieldMetadata {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Field()
  @Column()
  type: string;

  @Field()
  @Column()
  name: string;

  @Field()
  @Column()
  label: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  description?: string;

  /** User-facing inline help shown next to the field on record forms (Req 2). */
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
  @Column({ default: true })
  isActive: boolean;

  @Field()
  @Column({ default: false })
  isSystem: boolean;

  @Field(() => String)
  @Column({
    name: 'pii_classification',
    type: 'varchar',
    length: 16,
    default: 'none',
  })
  piiClassification: PiiClassification;

  @Field()
  @Column({ default: true })
  isNullable: boolean;

  @Field()
  @Column({ name: 'is_search_field', type: 'boolean', default: false })
  isSearchField: boolean;

  @Field()
  @Column({ name: 'search_weight', type: 'char', length: 1, default: 'D' })
  searchWeight: string;

  @Field()
  @Column({ default: false })
  isUnique: boolean;

  /** When false, uniqueness is enforced case-insensitively (Req 3.3). */
  @Field()
  @Column({ name: 'unique_case_sensitive', type: 'boolean', default: true })
  uniqueCaseSensitive: boolean;

  /** Marks an external primary key (upsert / integration reconciliation). Implies unique (Req 3.2). */
  @Field()
  @Column({ name: 'is_external_id', type: 'boolean', default: false })
  isExternalId: boolean;

  /** One-click field history tracking; syncs to FieldTrackingConfig at write time (Req 6.3). */
  @Field()
  @Column({ name: 'track_history', type: 'boolean', default: false })
  trackHistory: boolean;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  defaultValue?: any;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  options?: any;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  settings?: any;

  @Field()
  @Column({ default: true })
  isLabelSyncedWithName: boolean;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  translations?: Record<string, {
    label?: string;
    description?: string;
    options?: Record<string, string>;
  }>;

  @Field(() => RelationDefinition, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  relationDefinition?: RelationDefinition;

  @Field(() => RelationObjectMetadata, { nullable: true, description: 'Parent object reference' })
  @ManyToOne('ObjectMetadata', 'fieldsRaw')
  @JoinColumn({ name: 'objectMetadataId' })
  object: any;

  @Column()
  objectMetadataId: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
