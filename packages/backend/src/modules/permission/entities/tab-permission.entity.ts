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
 * TabPermission Entity
 *
 * Defines the permission relationship between Role and Tab (选项卡/二级导航菜单).
 * Controls which tabs are visible and which is the default for a role.
 *
 * Tab types and their permission behavior:
 * - OBJECT type: Permission links with object permission
 * - PAGE type: Independent permission control
 * - URL type: Independent permission control
 *
 * @see Requirement 3: 选项卡/二级菜单权限管理
 * - THE Role_Tab_Permission SHALL 支持：可见(visible)、默认(default)
 * - IF 选项卡类型为 OBJECT, THEN THE Tab_Permission SHALL 与对象权限联动
 * - IF 选项卡类型为 PAGE, THEN THE Tab_Permission SHALL 独立控制
 * - IF 选项卡类型为 URL, THEN THE Tab_Permission SHALL 独立控制
 */
@ObjectType()
@Entity('tab_permissions')
@Unique('IDX_TAB_PERMISSION_ROLE_ID_MENU_ITEM_ID_UNIQUE', [
  'roleId',
  'menuItemId',
])
@Index('IDX_TAB_PERMISSION_ROLE_ID', ['roleId'])
@Index('IDX_TAB_PERMISSION_MENU_ITEM_ID', ['menuItemId'])
export class TabPermission {
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
   * Reference to the tab MenuItem (type=OBJECT, PAGE, or URL)
   */
  @Field()
  @Column({ type: 'uuid' })
  menuItemId: string;

  /**
   * Whether the tab is visible to users with this role
   * @default true
   */
  @Field()
  @Column({ default: true })
  visible: boolean;

  /**
   * Whether this tab is the default tab for users with this role
   * within its parent nav item
   * @default false
   */
  @Field()
  @Column({ default: false })
  isDefault: boolean;

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
