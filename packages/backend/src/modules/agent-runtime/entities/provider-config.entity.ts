import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';
import { generateId } from '../../../common/utils/generate-id';

/**
 * LlmProviderConfig Entity
 *
 * Stores LLM provider configurations per workspace, supporting
 * multi-provider routing with priority-based fallback.
 * API keys are stored encrypted (AES-256).
 */
@ObjectType('LlmProviderConfig')
@Entity('llm_provider_configs')
@Index(['workspaceId'])
export class LlmProviderConfig {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Field()
  @Column('uuid')
  workspaceId: string;

  @Field()
  @Column({ type: 'varchar', length: 50 })
  providerName: string; // 'openai' | 'tongyi' | 'doubao' | 'anthropic' | 'deepseek' | 'custom'

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 500, nullable: true })
  apiEndpoint: string;

  @Column({ type: 'text' })
  apiKeyEncrypted: string; // AES-256 encrypted, not exposed via GraphQL

  @Field()
  @Column({ type: 'varchar', length: 100 })
  defaultModel: string;

  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  priority: number; // Lower value = higher priority

  @Field()
  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Field(() => [String])
  @Column({ type: 'text', array: true, default: '{}' })
  capabilities: string[]; // ['chat', 'embedding', 'vision']

  @Field()
  @Column({ type: 'boolean', default: false })
  isSystem: boolean; // System-default providers cannot be deleted/modified

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  metadata: Record<string, any>; // Provider-specific config

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
