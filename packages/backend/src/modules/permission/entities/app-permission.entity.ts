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
import { App } from '../../app-menu/entities/app.entity';
import { generateId } from '../../../common/utils/generate-id';

/**
 * AppPermission Entity
 * 
 * Defines the permission relationship between Role and App.
 * Controls which applications are visible and which is the default for a role.
 * 
 * @see Requirement 1: 应用权限管理
 * - THE Role_App_Permission SHALL 支持以下权限：可见(visible)、默认(default)
 */
@ObjectType()
@Entity('app_permissions')
@Unique('IDX_APP_PERMISSION_ROLE_ID_APP_ID_UNIQUE', ['roleId', 'appId'])
@Index('IDX_APP_PERMISSION_ROLE_ID', ['roleId'])
@Index('IDX_APP_PERMISSION_APP_ID', ['appId'])
export class AppPermission {
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

  @Field()
  @Column({ type: 'uuid' })
  appId: string;

  /**
   * Whether the app is visible to users with this role
   * @default true
   */
  @Field()
  @Column({ default: true })
  visible: boolean;

  /**
   * Whether this app is the default app for users with this role
   * Only one app can be default per role
   * @default false
   */
  @Field()
  @Column({ default: false })
  isDefault: boolean;

  @Field(() => App, { nullable: true })
  @ManyToOne(() => App, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appId' })
  app: App;

  // Note: Lazy import to avoid circular dependency
  @ManyToOne('Role', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: any;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
