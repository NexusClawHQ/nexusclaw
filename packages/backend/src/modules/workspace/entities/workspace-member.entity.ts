import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Workspace } from './workspace.entity';
import { User } from '../../user/entities/user.entity';
import { generateId } from '../../../common/utils/generate-id';

@ObjectType()
export class WorkspaceMemberName {
  @Field()
  firstName: string;

  @Field()
  lastName: string;
}

@ObjectType()
@Entity('workspace_members')
export class WorkspaceMember {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Field(() => WorkspaceMemberName)
  name: WorkspaceMemberName;

  @Column({ default: '' })
  firstName: string;

  @Column({ default: '' })
  lastName: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true })
  @Column({ default: 'en' })
  locale: string;

  @Field({ nullable: true })
  @Column({ default: 'Light' })
  colorScheme: string;

  @ManyToOne(() => Workspace)
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column()
  workspaceId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
