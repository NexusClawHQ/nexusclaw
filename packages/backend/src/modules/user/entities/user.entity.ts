import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { ObjectType, Field, GraphQLISODateTime, ID, Int } from '@nestjs/graphql';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { OrgNode } from '../../org-hierarchy/entities/org-node.entity';
import { Role } from '../../role/entities/role.entity';
import { GraphQLJSON } from 'graphql-scalars';
import { generateId } from '../../../common/utils/generate-id';

/**
 * User Entity
 *
 * Represents a system user with comprehensive profile information,
 * organizational relationships, and preference settings.
 *
 * @see Requirements 1.1, 1.2, 1.3, 1.6, 1.7, 1.8
 */
@ObjectType()
@Entity('users')
@Index('IDX_USER_IS_ACTIVE', ['isActive'])
@Index('IDX_USER_DEPARTMENT', ['department'])
@Index('IDX_USER_ROLE_ID', ['roleId'])
@Index('IDX_USER_ORG_NODE_ID', ['orgNodeId'])
@Index('IDX_USER_MANAGER_ID', ['managerId'])
export class User {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  /**
   * Username for login - unique across the system
   * Independent from the notification email and globally unique.
   */
  @Field()
  @Column({ unique: true })
  username: string;

  /**
   * Email address - can be duplicated across users, used for notifications
   */
  @Field()
  @Column()
  email: string;

  @Column()
  passwordHash: string;

  @Field()
  @Column({ default: '' })
  firstName: string;

  @Field()
  @Column({ default: '' })
  lastName: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true })
  @Column({ default: 'en' })
  locale: string;

  @Field(() => Workspace, { nullable: true })
  @ManyToOne(() => Workspace, { nullable: true })
  @JoinColumn({ name: 'defaultWorkspaceId' })
  defaultWorkspace?: Workspace;

  @Field(() => ID, { nullable: true })
  @Column({ nullable: true })
  defaultWorkspaceId?: string;

  // ============================================
  // P0 必需字段 (Required Fields)
  // ============================================

  /**
   * User's phone number
   * @see Requirement 1.1
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  /**
   * User's job title
   * @see Requirement 1.1
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  title?: string;

  /**
   * User's department
   * @see Requirement 1.1
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  department?: string;

  /**
   * Whether the user account is active
   * @default true
   * @see Requirement 1.1
   */
  @Field()
  @Column({ default: true })
  isActive: boolean;

  /**
   * Service/system account flag (工号): a non-login principal that backs an AI
   * employee (Agent). Can OWN records and be attributed in audit, but never logs
   * in (hasPasswordSet stays false). Distinguishes 工号 from human users.
   */
  @Field()
  @Column({ default: false })
  isServiceAccount: boolean;

  /**
   * User's timezone setting
   * @default 'UTC'
   * @see Requirement 1.1
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  timeZone: string;

  // ============================================
  // P1 重要字段 (Important Fields)
  // ============================================

  /**
   * Self-referencing relationship to manager
   * @see Requirement 1.8
   */
  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'managerId' })
  manager?: User;

  /**
   * Manager's user ID
   * @see Requirement 1.2
   */
  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  managerId?: string;

  /**
   * Role ID for permission control
   * Note: Role entity relationship is defined below
   * @see Requirement 1.6
   */
  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  roleId?: string | null;

  /**
   * Role relationship for permission control
   * @see Requirement 1.6
   */
  @Field(() => Role, { nullable: true })
  @ManyToOne(() => Role, (role) => role.users, { nullable: true })
  @JoinColumn({ name: 'roleId' })
  role?: Role;

  /**
   * Organization node relationship
   * @see Requirement 1.7
   */
  @Field(() => OrgNode, { nullable: true })
  @ManyToOne(() => OrgNode, { nullable: true })
  @JoinColumn({ name: 'orgNodeId' })
  orgNode?: OrgNode;

  /**
   * Organization node ID
   * @see Requirement 1.2
   */
  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  orgNodeId?: string;

  /**
   * User's preferred date format
   * @default 'YYYY-MM-DD'
   * @see Requirement 1.2
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 20, default: 'YYYY-MM-DD' })
  dateFormat: string;

  /**
   * User's preferred time format
   * @default 'HH:mm:ss'
   * @see Requirement 1.2
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 20, default: 'HH:mm:ss' })
  timeFormat: string;

  // ============================================
  // P2 可选字段 (Optional Fields)
  // ============================================

  /**
   * User's alias/nickname
   * @see Requirement 1.3
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  alias?: string;

  /**
   * Phone extension number
   * @see Requirement 1.3
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  extension?: string;

  /**
   * Fax number
   * @see Requirement 1.3
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  fax?: string;

  /**
   * Company name
   * @see Requirement 1.3
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  company?: string;

  /**
   * Division within the company
   * @see Requirement 1.3
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  division?: string;

  /**
   * User's address stored as JSON
   * Structure: { street, city, state, postalCode, country }
   * @see Requirement 1.3
   */
  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  address?: Record<string, string>;

  /**
   * Self-referencing relationship to delegated approver
   * @see Requirement 1.3
   */
  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'delegatedApproverId' })
  delegatedApprover?: User;

  /**
   * Delegated approver's user ID
   * @see Requirement 1.3
   */
  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  delegatedApproverId?: string;

  /**
   * Federation ID for SSO integration
   * @see Requirement 1.3
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  federationId?: string;

  /**
   * User's preferred number format
   * @default '1,000.00'
   * @see Requirement 1.3
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 20, default: '1,000.00' })
  numberFormat: string;

  /**
   * User's preferred color scheme
   * @default 'light'
   * @see Requirement 1.3
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 20, default: 'light' })
  colorScheme: string;

  /**
   * Calendar start day (0 = Sunday, 1 = Monday, etc.)
   * @default 0
   * @see Requirement 1.3
   */
  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', default: 0 })
  calendarStartDay: number;

  /**
   * Whether compact mode is enabled
   * @default false
   */
  @Field()
  @Column({ default: false })
  compactMode: boolean;

  /**
   * Whether to show welcome banner
   * @default true
   */
  @Field()
  @Column({ default: true })
  showWelcomeBanner: boolean;

  /**
   * Notification preferences stored as JSON
   * Structure: { email: {...}, inApp: {...} }
   * @default '{}'
   */
  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', default: '{}' })
  notificationPreferences: Record<string, any>;

  /**
   * Whether the user's email has been verified
   * @default false
   * @see Requirement 1.3
   */
  @Field()
  @Column({ default: false })
  isEmailVerified: boolean;

  /**
   * Timestamp of user's last login
   * @see Requirement 1.3
   */
  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  // ============================================
  // Account Status Fields (Salesforce-style)
  // ============================================

  /**
   * Whether the account is frozen (cannot login)
   * Unlike isActive (deactivation), freeze is reversible and typically
   * used for security reasons or temporary restrictions
   */
  @Field()
  @Column({ default: false })
  isFrozen: boolean;

  /**
   * Customer-granted support access for platform support impersonation.
   * Platform admins may only Login As this user while this flag is enabled
   * and supportImpersonationExpiresAt is still in the future.
   */
  @Field()
  @Column({ default: false })
  supportImpersonationEnabled: boolean;

  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  supportImpersonationExpiresAt?: Date;

  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  supportImpersonationGrantedById?: string;

  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'supportImpersonationGrantedById' })
  supportImpersonationGrantedBy?: User;

  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  supportImpersonationGrantedAt?: Date;

  /**
   * Timestamp when account was frozen
   */
  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  frozenAt?: Date;

  /**
   * User who froze this account
   */
  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'frozenById' })
  frozenBy?: User;

  /**
   * ID of user who froze this account
   */
  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  frozenById?: string;

  /**
   * Reason for freezing the account
   */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 500, nullable: true })
  frozenReason?: string;

  /**
   * Whether the user has set their initial password
   * False = user needs to set password via activation email
   */
  @Field()
  @Column({ default: false })
  hasPasswordSet: boolean;

  /**
   * Activation token for new user email verification
   * Used when admin creates user and sends welcome email
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  activationToken?: string;

  /**
   * Expiration time for activation token
   * Default: 72 hours (3 days) for new user activation
   */
  @Column({ type: 'timestamptz', nullable: true })
  activationTokenExpiresAt?: Date;

  /**
   * Password reset token
   * Used for forgot password flow
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordResetToken?: string;

  /**
   * Expiration time for password reset token
   * Default: 24 hours
   */
  @Column({ type: 'timestamptz', nullable: true })
  passwordResetTokenExpiresAt?: Date;

  /**
   * Failed login attempt count
   * Reset to 0 on successful login
   */
  @Field()
  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  /**
   * Timestamp of last failed login attempt
   * Used for rate limiting
   */
  @Column({ type: 'timestamptz', nullable: true })
  lastFailedLoginAt?: Date;

  /**
   * Timestamp when user was activated (first login or email verification)
   */
  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  activatedAt?: Date;

  /**
   * Last step-up factor verification timestamp; null until first successful
   * step-up. Independent from MfaFactor.lastUsedAt (Frozen Decision 9).
   * @see Requirement 7.3
   */
  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ name: 'last_step_up_at', type: 'timestamptz', nullable: true })
  lastStepUpAt: Date | null;

  // ============================================
  // Timestamps
  // ============================================

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
