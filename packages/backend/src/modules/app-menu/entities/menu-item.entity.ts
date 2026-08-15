import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';
import { App } from './app.entity';
import { generateId } from '../../../common/utils/generate-id';

export enum MenuItemType {
  OBJECT = 'object',
  PAGE = 'page',
  URL = 'url',
  FOLDER = 'folder',
}

registerEnumType(MenuItemType, {
  name: 'MenuItemType',
  description: 'Type of menu item',
});

@ObjectType()
@Index('IDX_menu_items_app_api_name_unique', ['appId', 'apiName'], { unique: true })
@Entity('menu_items')
export class MenuItem {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Field()
  @Column()
  name: string;

  /** Unique API name for deployment/migration key */
  @Field()
  @Column({ length: 100 })
  apiName: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  icon?: string;

  @Field({ nullable: true })
  @Column({ name: 'i18n_key', nullable: true })
  i18nKey?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  translations?: Record<string, {
    name?: string;
  }>;

  @Field({ nullable: true })
  @Column({ nullable: true })
  path?: string;

  @Field(() => MenuItemType)
  @Column({ type: 'enum', enum: MenuItemType, default: MenuItemType.PAGE })
  type: MenuItemType;

  @Field({ nullable: true })
  @Column({ nullable: true })
  targetObjectId?: string;

  @Field(() => Int)
  @Column({ default: 0 })
  position: number;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field(() => ID)
  @Column()
  appId: string;

  @Field(() => App)
  @ManyToOne(() => App, (app) => app.menuItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appId' })
  app: App;

  // parentId only used for FOLDER hierarchy (folder within folder)
  // Tabs (OBJECT/PAGE/URL) should NOT use parentId
  @Field(() => String, { nullable: true })
  @Column({ nullable: true })
  parentId?: string;

  @Field(() => MenuItem, { nullable: true })
  @ManyToOne(() => MenuItem, (menuItem) => menuItem.children, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent?: MenuItem;

  @Field(() => [MenuItem], { nullable: true })
  @OneToMany(() => MenuItem, (menuItem) => menuItem.parent)
  children?: MenuItem[];

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
