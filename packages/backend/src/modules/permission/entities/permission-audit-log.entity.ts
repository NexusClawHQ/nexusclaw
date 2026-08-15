import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';
import { generateId } from '../../../common/utils/generate-id';

/**
 * Permission change action type
 */
export enum PermissionChangeAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

/**
 * Permission change target type
 */
export enum PermissionChangeTarget {
  APP_PERMISSION = 'APP_PERMISSION',
  NAV_ITEM_PERMISSION = 'NAV_ITEM_PERMISSION',
  TAB_PERMISSION = 'TAB_PERMISSION',
  RECORD_TYPE_PERMISSION = 'RECORD_TYPE_PERMISSION',
  OWD_SETTING = 'OWD_SETTING',
  SHARING_RULE = 'SHARING_RULE',
  ORG_NODE = 'ORG_NODE',
  USER_ORG_ASSIGNMENT = 'USER_ORG_ASSIGNMENT',
  // Additional permission-change targets use the transaction-aware
  // transaction-aware PermissionAuditService.writeRequired path.
  ROLE = 'ROLE',
  PERMISSION_SET = 'PERMISSION_SET',
  PERMISSION_SET_ASSIGNMENT = 'PERMISSION_SET_ASSIGNMENT',
  PUBLIC_GROUP = 'PUBLIC_GROUP',
  PUBLIC_GROUP_MEMBER = 'PUBLIC_GROUP_MEMBER',
  OBJECT_PERMISSION = 'OBJECT_PERMISSION',
  FIELD_PERMISSION = 'FIELD_PERMISSION',
  USER_ROLE_ASSIGNMENT = 'USER_ROLE_ASSIGNMENT',
}

// Register enums for GraphQL
registerEnumType(PermissionChangeAction, {
  name: 'PermissionChangeAction',
  description: 'Type of permission change action',
});

registerEnumType(PermissionChangeTarget, {
  name: 'PermissionChangeTarget',
  description: 'Type of permission change target',
});

/**
 * PermissionAuditLog Entity
 *
 * Records all permission configuration changes for audit purposes.
 *
 * @requirements
 * - 记录所有权限配置变更
 * - 支持多维度查询
 * - 支持 CSV/Excel 导出
 */
@ObjectType()
@Entity('permission_audit_logs')
@Index('IDX_PERMISSION_AUDIT_LOG_WORKSPACE_ID', ['workspaceId'])
@Index('IDX_PERMISSION_AUDIT_LOG_USER_ID', ['userId'])
@Index('IDX_PERMISSION_AUDIT_LOG_ROLE_ID', ['roleId'])
@Index('IDX_PERMISSION_AUDIT_LOG_TARGET_TYPE', ['targetType'])
@Index('IDX_PERMISSION_AUDIT_LOG_CREATED_AT', ['createdAt'])
export class PermissionAuditLog {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  /**
   * Workspace where the change occurred
   */
  @Field()
  @Column({ type: 'uuid' })
  workspaceId: string;

  /**
   * User who made the change
   */
  @Field()
  @Column({ type: 'uuid' })
  userId: string;

  /**
   * Role affected by the change (if applicable)
   */
  @Field(() => String, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  roleId: string | null;

  /**
   * Type of permission target that was changed
   */
  @Field(() => PermissionChangeTarget)
  @Column({
    type: 'enum',
    enum: PermissionChangeTarget,
  })
  targetType: PermissionChangeTarget;

  /**
   * ID of the target entity that was changed
   */
  @Field()
  @Column({ type: 'uuid' })
  targetId: string;

  /**
   * Action performed
   */
  @Field(() => PermissionChangeAction)
  @Column({
    type: 'enum',
    enum: PermissionChangeAction,
  })
  action: PermissionChangeAction;

  /**
   * Previous values before the change (for UPDATE and DELETE)
   */
  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  previousValues: Record<string, any> | null;

  /**
   * New values after the change (for CREATE and UPDATE)
   */
  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  newValues: Record<string, any> | null;

  /**
   * Additional metadata about the change
   */
  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  /**
   * IP address of the user who made the change
   */
  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  /**
   * User agent of the client
   */
  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
