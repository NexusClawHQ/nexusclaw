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
 * ObjectPermission Entity
 *
 * Defines the permission relationship between Role and Object (ObjectMetadata).
 * Controls CRUD permissions and advanced permissions (viewAll, modifyAll).
 *
 * Permission levels:
 * - canRead: Can view records (subject to OWD and sharing rules)
 * - canCreate: Can create new records
 * - canEdit: Can edit records (subject to OWD and sharing rules)
 * - canDelete: Can delete records (subject to OWD and sharing rules)
 * - canViewAll: Can view all records (ignores OWD and sharing rules)
 * - canModifyAll: Can edit and delete all records (implies canViewAll)
 *
 * @see Requirement 5: 对象权限管理（增强现有）
 * - THE Object_Permission SHALL 支持：读取(read)、创建(create)、编辑(edit)、删除(delete)、查看全部(viewAll)、修改全部(modifyAll)
 * - THE viewAll 权限 SHALL 允许查看所有记录（忽略 OWD 和共享规则）
 * - THE modifyAll 权限 SHALL 允许编辑和删除所有记录
 * - IF 职权有 modifyAll 权限, THEN THE System SHALL 自动授予 viewAll 权限
 */
@ObjectType()
@Entity('object_permissions')
@Unique('IDX_OBJECT_PERMISSION_ROLE_ID_OBJECT_METADATA_ID_UNIQUE', [
  'roleId',
  'objectMetadataId',
])
@Index('IDX_OBJECT_PERMISSION_ROLE_ID', ['roleId'])
@Index('IDX_OBJECT_PERMISSION_OBJECT_METADATA_ID', ['objectMetadataId'])
export class ObjectPermission {
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
   * Reference to the ObjectMetadata
   */
  @Field()
  @Column({ type: 'uuid' })
  objectMetadataId: string;

  /**
   * Basic CRUD permissions
   */

  /**
   * Whether users with this role can read records of this object
   * Subject to OWD and sharing rules unless canViewAll is true
   * @default false
   */
  @Field()
  @Column({ default: false })
  canRead: boolean;

  /**
   * Whether users with this role can create new records of this object
   * @default false
   */
  @Field()
  @Column({ default: false })
  canCreate: boolean;

  /**
   * Whether users with this role can edit records of this object
   * Subject to OWD and sharing rules unless canModifyAll is true
   * @default false
   */
  @Field()
  @Column({ default: false })
  canEdit: boolean;

  /**
   * Whether users with this role can delete records of this object
   * Subject to OWD and sharing rules unless canModifyAll is true
   * @default false
   */
  @Field()
  @Column({ default: false })
  canDelete: boolean;

  /**
   * Advanced permissions
   */

  /**
   * Whether users with this role can view all records (ignores OWD and sharing rules)
   * @default false
   */
  @Field()
  @Column({ default: false })
  canViewAll: boolean;

  /**
   * Whether users with this role can modify all records (edit and delete)
   * Automatically grants canViewAll
   * @default false
   */
  @Field()
  @Column({ default: false })
  canModifyAll: boolean;

  // Note: Lazy import to avoid circular dependency
  @ManyToOne('Role', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: any;

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
