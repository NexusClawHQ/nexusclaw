import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
  BeforeInsert,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { generateId } from '../../../common/utils/generate-id';

/**
 * RecordTypePermission Entity
 *
 * Defines the permission relationship between Role and RecordType.
 * Controls which record types a role can read, create, and which is the default.
 *
 * Permission behavior:
 * - canRead: If false, records of this type are filtered from list views
 * - canCreate: If true, this record type appears in the new record type selector
 * - isDefault: The default record type when creating new records (one per role-object combination)
 *
 * @see Requirement 4: 记录类型权限管理
 * - THE Role_RecordType_Permission SHALL 支持：可读(read)、可创建(create)、默认(default)
 * - IF 职权对某记录类型有 create 权限, THEN THE System SHALL 在新建记录时显示该类型选项
 * - IF 职权对某记录类型无 read 权限, THEN THE System SHALL 在列表中过滤该类型的记录
 * - THE System SHALL 为每个职权设置一个默认记录类型
 * - WHEN 职权无任何记录类型权限时, THE System SHALL 使用主记录类型
 */
@ObjectType()
@Entity('record_type_permissions')
@Unique('IDX_RECORD_TYPE_PERMISSION_ROLE_ID_RECORD_TYPE_ID_UNIQUE', [
  'roleId',
  'recordTypeId',
])
@Index('IDX_RECORD_TYPE_PERMISSION_ROLE_ID', ['roleId'])
@Index('IDX_RECORD_TYPE_PERMISSION_RECORD_TYPE_ID', ['recordTypeId'])
@Index('IDX_RECORD_TYPE_PERMISSION_OBJECT_METADATA_ID', ['objectMetadataId'])
@Index('IDX_RECORD_TYPE_PERMISSION_ROLE_OBJECT', ['roleId', 'objectMetadataId'])
export class RecordTypePermission {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Field()
  @Column({ type: 'uuid' })
  roleId: string;

  /**
   * Reference to the RecordType
   */
  @Field()
  @Column({ type: 'uuid' })
  recordTypeId: string;

  /**
   * Reference to the ObjectMetadata that this record type belongs to
   * Used for grouping permissions by object in the UI
   */
  @Field()
  @Column({ type: 'uuid' })
  objectMetadataId: string;

  /**
   * Whether users with this role can read records of this type
   * If false, records of this type are filtered from list views
   * @default true
   */
  @Field()
  @Column({ default: true })
  canRead: boolean;

  /**
   * Whether users with this role can create records of this type
   * If true, this record type appears in the new record type selector
   * @default true
   */
  @Field()
  @Column({ default: true })
  canCreate: boolean;

  /**
   * Whether this is the default record type for this role-object combination
   * Only one record type can be default per role-object combination
   * When creating a new record, this type is pre-selected
   * @default false
   */
  @Field()
  @Column({ default: false })
  isDefault: boolean;

  // Note: Lazy import to avoid circular dependency
  @ManyToOne('Role', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: any;

  // Note: RecordType relation will be added when RecordType entity is available
  // @ManyToOne(() => RecordType, { onDelete: 'CASCADE' })
  // @JoinColumn({ name: 'recordTypeId' })
  // recordType: RecordType;

  // Note: ObjectMetadata relation will be added when ObjectMetadata entity is available
  // @ManyToOne(() => ObjectMetadata, { onDelete: 'CASCADE' })
  // @JoinColumn({ name: 'objectMetadataId' })
  // objectMetadata: ObjectMetadata;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
