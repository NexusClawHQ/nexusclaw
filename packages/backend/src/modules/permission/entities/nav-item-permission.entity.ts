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
import { MenuItem } from '../../app-menu/entities/menu-item.entity';
import { generateId } from '../../../common/utils/generate-id';

/**
 * NavItemPermission Entity
 *
 * Defines the permission relationship between Role and NavItem (一级导航菜单).
 * Controls which first-level navigation items are visible for a role.
 *
 * @see Requirement 2: 一级菜单权限管理
 * - THE Role_NavItem_Permission SHALL 支持：可见(visible)
 * - IF 职权未被授权访问某一级菜单, THEN THE System SHALL 在导航中隐藏该菜单
 */
@ObjectType()
@Entity('nav_item_permissions')
@Unique('IDX_NAV_ITEM_PERMISSION_ROLE_ID_MENU_ITEM_ID_UNIQUE', [
  'roleId',
  'menuItemId',
])
@Index('IDX_NAV_ITEM_PERMISSION_ROLE_ID', ['roleId'])
@Index('IDX_NAV_ITEM_PERMISSION_MENU_ITEM_ID', ['menuItemId'])
export class NavItemPermission {
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
   * Reference to the first-level navigation MenuItem (type=FOLDER)
   */
  @Field()
  @Column({ type: 'uuid' })
  menuItemId: string;

  /**
   * Whether the nav item is visible to users with this role
   * @default true
   */
  @Field()
  @Column({ default: true })
  visible: boolean;

  @Field(() => MenuItem, { nullable: true })
  @ManyToOne(() => MenuItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menuItemId' })
  menuItem: MenuItem;

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
