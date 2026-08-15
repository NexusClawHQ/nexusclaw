import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  BeforeInsert,
} from 'typeorm';
import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';

/**
 * Session limit policy when concurrent sessions exceed the maximum.
 * KICK_OLDEST: Revoke the oldest active session to allow the new one.
 * BLOCK_NEW: Reject the new session creation.
 */
export enum SessionLimitPolicy {
  KICK_OLDEST = 'KICK_OLDEST',
  BLOCK_NEW = 'BLOCK_NEW',
}

registerEnumType(SessionLimitPolicy, {
  name: 'SessionLimitPolicy',
  description: 'Policy to apply when concurrent session limit is exceeded',
});
import { User } from '../../user/entities/user.entity';
import { generateId } from '../../../common/utils/generate-id';

/**
 * Role Entity
 * 
 * 职权是权限的集合，可分配给用户以控制其对系统功能和数据的访问。
 * 参考 Salesforce 的 Profile 概念。
 * 
 * Role is a collection of permissions that can be assigned to users to control
 * their access to system features and data.
 * 
 * @see Design Document: Role Entity
 * @see Requirements: 职权权限与组织架构系统
 */
@ObjectType()
@Entity('roles')
@Index('IDX_ROLE_WORKSPACE_ID', ['workspaceId'])
@Index('IDX_ROLE_NAME_WORKSPACE_ID_UNIQUE', ['name', 'workspaceId'], { unique: true })
@Index('IDX_ROLE_API_NAME_WORKSPACE_ID_UNIQUE', ['apiName', 'workspaceId'], { unique: true })
@Index('IDX_ROLE_IS_SYSTEM', ['isSystem'])
@Index('IDX_ROLE_IS_ACTIVE', ['isActive'])
export class Role {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Field()
  @Column({ type: 'uuid' })
  workspaceId: string;

  /**
   * Role label (display name, can be changed)
   * 职权标签（显示名称，可修改）
   */
  @Field()
  @Column({ length: 100 })
  label: string;

  /**
   * Role API name (unique identifier within workspace, can be changed but must remain unique)
   * 职权 API 名称（工作空间内唯一标识符，可修改但必须保持唯一）
   * Format: PascalCase, e.g., SystemAdministrator, StandardUser
   */
  @Field()
  @Column({ length: 100 })
  apiName: string;

  /**
   * @deprecated Use 'label' instead. Kept for backward compatibility.
   * Role name (unique within workspace)
   * 职权名称（工作空间内唯一）
   */
  @Field()
  @Column({ length: 100 })
  name: string;

  /**
   * Role description
   * 职权描述
   */
  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Whether this is a system role (system roles cannot be deleted)
   * 是否为系统职权（系统职权不可删除）
   * @default false
   */
  @Field()
  @Column({ default: false })
  isSystem: boolean;

  /**
   * Whether this role is active
   * 是否激活
   * @default true
   */
  @Field()
  @Column({ default: true })
  isActive: boolean;

  // ============================================
  // System Permissions - 系统权限（参考 Salesforce Profile）
  // ============================================

  /**
   * Can manage users (create, edit, delete users)
   * 管理用户（创建、编辑、删除用户）
   * @default false
   */
  @Field()
  @Column({ default: false })
  canManageUsers: boolean;

  /**
   * Can manage roles (create, edit, delete roles and assign permissions)
   * 管理职权（创建、编辑、删除职权及分配权限）
   * @default false
   */
  @Field()
  @Column({ default: false })
  canManageRoles: boolean;

  /**
   * Can manage apps (create, edit, delete apps and menus)
   * 管理应用（创建、编辑、删除应用和菜单）
   * @default false
   */
  @Field()
  @Column({ default: false })
  canManageApps: boolean;

  /**
   * Can customize objects (create, edit custom objects and fields)
   * 自定义对象（创建、编辑自定义对象和字段）
   * @default false
   */
  @Field()
  @Column({ default: false })
  canCustomizeObjects: boolean;

  /**
   * Can develop (create pages, triggers, serverless functions)
   * 开发权限（创建页面、触发器、无服务器函数）
   * @default false
   */
  @Field()
  @Column({ default: false })
  canDevelop: boolean;

  /**
   * Can manage data sharing rules
   * 管理数据共享规则
   * @default false
   */
  @Field()
  @Column({ default: false })
  canManageDataSharing: boolean;

  /**
   * Can view setup and configuration
   * 查看设置和配置
   * @default false
   */
  @Field()
  @Column({ default: false })
  canViewSetup: boolean;

  /**
   * Explicit fine-grained capability grants.
   *
   * These are additive to the legacy boolean role flags. New capability
   * contracts such as ai.manage MUST read this list instead of inferring an
   * authorization from isSystem/apiName.
   */
  @Field(() => [String])
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  capabilityGrants: string[];

  // ============================================
  // Session Concurrency Control - 会话并发控制
  // ============================================

  /**
   * Maximum number of concurrent active sessions per user under this role.
   * 0 means no limit (backward compatible).
   * 此职权下每个用户允许的最大并发活跃会话数。0 表示不限制（向后兼容）。
   * @default 5
   */
  @Field(() => Int)
  @Column({ type: 'int', default: 5 })
  maxConcurrentSessions: number;

  /**
   * Policy to apply when concurrent session limit is exceeded.
   * KICK_OLDEST: revoke the oldest active session (by lastActiveAt).
   * BLOCK_NEW: reject the new session creation.
   * 并发超限策略。KICK_OLDEST: 踢出最旧会话；BLOCK_NEW: 拒绝新会话。
   * @default KICK_OLDEST
   */
  @Field(() => SessionLimitPolicy)
  @Column({
    type: 'varchar',
    length: 20,
    default: SessionLimitPolicy.KICK_OLDEST,
  })
  sessionLimitPolicy: SessionLimitPolicy;

  // ============================================
  // Relationships - 关联关系
  // ============================================

  /**
   * Users assigned to this role
   * 分配到此职权的用户
   */
  @Field(() => [User], { nullable: true })
  @OneToMany(() => User, (user) => user.role)
  users: User[];

  /**
   * App permissions for this role
   * 此职权的应用权限
   * Note: Using lazy loading to avoid circular dependency
   */
  @OneToMany('AppPermission', 'role')
  appPermissions: any[];

  /**
   * NavItem (first-level menu) permissions for this role
   * 此职权的一级菜单权限
   * Note: Using lazy loading to avoid circular dependency
   */
  @OneToMany('NavItemPermission', 'role')
  navItemPermissions: any[];

  /**
   * Tab (second-level menu) permissions for this role
   * 此职权的选项卡权限
   * Note: Using lazy loading to avoid circular dependency
   */
  @OneToMany('TabPermission', 'role')
  tabPermissions: any[];

  /**
   * Record type permissions for this role
   * 此职权的记录类型权限
   * Note: Using lazy loading to avoid circular dependency
   */
  @OneToMany('RecordTypePermission', 'role')
  recordTypePermissions: any[];

  /**
   * Login IP ranges configured for this role
   * 此职权配置的登录 IP 范围
   * Note: Using lazy loading to avoid circular dependency
   */
  @OneToMany('LoginIpRange', 'role')
  loginIpRanges: any[];

  // Note: ObjectPermission and FieldPermission relations will be added
  // when those entities are created in the permission module
  // 注意：ObjectPermission 和 FieldPermission 关联将在这些实体创建后添加

  // ============================================
  // Timestamps - 时间戳
  // ============================================

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  /**
   * User who created this role
   * 创建此职权的用户
   */
  @Field(() => String, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  /**
   * User who last updated this role
   * 最后更新此职权的用户
   */
  @Field(() => String, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;
}
