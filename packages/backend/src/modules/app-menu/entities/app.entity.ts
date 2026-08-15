import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';
import { MenuItem } from './menu-item.entity';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { AppPermission } from '../../permission/entities/app-permission.entity';
import { generateId } from '../../../common/utils/generate-id';

export enum AppPlatform {
  PC = 'pc',
  MOBILE = 'mobile',
  BOTH = 'both',
}

export enum AppNavStyle {
  STANDARD = 'standard',
  CONSOLE = 'console',
}

registerEnumType(AppPlatform, {
  name: 'AppPlatform',
  description: 'Supported platforms for the app',
});

registerEnumType(AppNavStyle, {
  name: 'AppNavStyle',
  description: 'Navigation style for the app',
});

@ObjectType()
@Index('UQ_apps_workspace_api_name', ['workspaceId', 'apiName'], { unique: true })
@Entity('apps')
export class App {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Field()
  @Column()
  apiName: string;

  @Field()
  @Column()
  name: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  @Column({ name: 'i18n_key', nullable: true })
  i18nKey?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  translations?: Record<string, {
    name?: string;
    description?: string;
  }>;

  @Field({ nullable: true })
  @Column({ nullable: true })
  icon?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  color?: string;

  @Field(() => Int)
  @Column({ default: 0 })
  position: number;

  @Field()
  @Column({ default: false })
  isDefault: boolean;

  @Field()
  @Column({ default: false })
  isSystem: boolean;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field(() => AppPlatform)
  @Column({ type: 'enum', enum: AppPlatform, default: AppPlatform.BOTH })
  platform: AppPlatform;

  @Field(() => AppNavStyle)
  @Column({ type: 'enum', enum: AppNavStyle, default: AppNavStyle.STANDARD })
  navStyle: AppNavStyle;

  @Field({ nullable: true })
  @Column({ nullable: true })
  logoUrl?: string;

  @Field(() => [String], { nullable: true })
  @Column({ type: 'simple-array', nullable: true })
  utilityItems?: string[];

  @Field(() => [String], { nullable: true })
  @Column({ type: 'simple-array', nullable: true })
  assignedRoles?: string[];

  @Field()
  @Column({ default: true })
  allowPersonalization: boolean;

  // Home page dashboard configuration per app
  @Field({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  homeDashboardId?: string;

  // Home page Page Builder configuration per app
  @Field({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  homePageDefinitionId?: string;

  @Column({ nullable: true })
  workspaceId?: string;

  @ManyToOne(() => Workspace, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace?: Workspace;

  @Field(() => [MenuItem], { nullable: true })
  @OneToMany(() => MenuItem, (menuItem) => menuItem.app, { cascade: true })
  menuItems?: MenuItem[];

  @Field(() => [AppPermission], { nullable: true })
  @OneToMany(() => AppPermission, (appPermission) => appPermission.app)
  appPermissions?: AppPermission[];

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
