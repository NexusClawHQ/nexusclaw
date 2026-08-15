import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';
import { AgentDefinition } from '../../agent-builder/interfaces/agent-definition.interface';
import { generateId } from '../../../common/utils/generate-id';

/**
 * Agent Entity
 *
 * Represents an AI agent that can be assigned to a role
 * and perform automated tasks within the workspace.
 */
@ObjectType('Agent')
@Entity('agents')
@Index(['workspaceId'])
export class Agent {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Column()
  @Index()
  workspaceId: string;

  @Field()
  @Column()
  name: string;

  /** Unique API name for deployment/migration key */
  @Field()
  @Column({ length: 100 })
  apiName: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  label?: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  icon?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  avatarPresetKey?: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  prompt?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  modelId?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  responseFormat?: string;

  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  roleId?: string;

  // 工号: the service-account user that backs this AI employee. Agent-created
  // records are owned by this user; agent/distiller writes are attributed to it.
  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  serviceUserId?: string;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field()
  @Column({ default: false })
  isCustom: boolean;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  modelConfiguration?: Record<string, any>;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  evaluationInputs?: Record<string, any>;

  @Field({ nullable: true })
  @Column({ nullable: true })
  applicationId?: string;

  // === AGL Runtime Extensions ===

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 20, default: 'custom' })
  type: string; // sales | service | analytics | admin | custom

  @Field(() => [String], { nullable: true })
  @Column({ type: 'text', array: true, nullable: true })
  capabilities?: string[];

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  triggerConfig?: Record<string, any>;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  guardrailRules?: Record<string, any>;

  @Field(() => [String], { nullable: true })
  @Column({ type: 'uuid', array: true, nullable: true })
  knowledgeBaseIds?: string[];

  /**
   * SOP documents that must be injected into this agent's runtime context
   * (AELG-1.1, 2026-07-25). Projected from `definition.sopDocumentIds` by
   * `AgentBuilderService.applyDefinitionToRuntimeFields` and consumed by
   * `ContextBuilderService.loadSopContext` — unlike the old behavior where
   * `sopDocumentIds` only existed in the definition JSON and was never read
   * at execution time. Direct ID lookup (not vector search) because these
   * are contractually bound by the user and must be injected in full.
   */
  @Field(() => [String], { nullable: true })
  @Column({ type: 'uuid', array: true, nullable: true })
  sopDocumentIds?: string[];

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  modelConfig?: Record<string, any>;

  @Field({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  orgNodeId?: string;

  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  deployedAt?: Date;

  @Field()
  @Column({ type: 'int', default: 1 })
  version: number;

  // === Agent Builder Extensions ===

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: 'draft' | 'active' | 'archived';

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  definition?: AgentDefinition;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
