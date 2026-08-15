/**
 * AIProviderConfig — platform-admin owned AI provider configuration.
 *
 * Contract: docs/specs/platform-provider-control-plane/ai-provider-config-contract.md
 *
 * This row stores provider capability and routing metadata only. Provider
 * credentials live behind `secretRef`; raw provider keys must never be stored
 * in this entity or returned through customer/org admin surfaces.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Field, HideField, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';

export type AIProviderKind =
  | 'openai_compatible'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'tongyi_dashscope'
  | 'doubao'
  | 'zhipu'
  | 'local_moe'
  | 'custom';

export type AIProviderConfigStatus = 'active' | 'draining' | 'disabled';

export type AIProviderHealthStatus =
  'unknown' | 'healthy' | 'degraded' | 'down';

export type AIProviderModelStatus = 'active' | 'draining' | 'disabled';

export interface AIProviderModelDescriptor {
  modelId: string;
  displayName?: string;
  capabilities: string[];
  tier: number;
  maxTokens: number;
  inputCostPer1k?: number;
  outputCostPer1k?: number;
  supportsStreaming?: boolean;
  status: AIProviderModelStatus;
  metadataMasked?: Record<string, unknown>;
}

@ObjectType()
@Entity('ai_provider_configs')
export class AIProviderConfig {
  @Field()
  @PrimaryColumn({ name: 'provider_config_key', type: 'varchar', length: 96 })
  providerConfigKey: string;

  @Field()
  @Column({
    name: 'provider_family',
    type: 'varchar',
    length: 16,
    default: 'ai',
  })
  providerFamily: 'ai';

  @Field(() => String)
  @Column({ name: 'provider_kind', type: 'varchar', length: 48 })
  providerKind: AIProviderKind;

  @Field()
  @Column({ name: 'label', type: 'varchar', length: 160 })
  label: string;

  @Field(() => String)
  @Column({ name: 'status', type: 'varchar', length: 32, default: 'active' })
  status: AIProviderConfigStatus;

  @Field(() => String, { nullable: true })
  @Column({ name: 'base_url', type: 'varchar', length: 500, nullable: true })
  baseUrl: string | null;

  @Field()
  @Column({ name: 'internal_endpoint', type: 'boolean', default: false })
  internalEndpoint: boolean;

  @Field(() => GraphQLJSON)
  @Column({ name: 'model_list', type: 'jsonb', default: () => "'[]'::jsonb" })
  modelList: AIProviderModelDescriptor[];

  @Field()
  @Column({ name: 'default_model', type: 'varchar', length: 160 })
  defaultModel: string;

  @Field(() => [String])
  @Column({
    name: 'enabled_capabilities',
    type: 'text',
    array: true,
    default: '{}',
  })
  enabledCapabilities: string[];

  @HideField()
  @Column({ name: 'secret_ref', type: 'varchar', length: 240 })
  secretRef: string;

  /** Irreversible GraphQL metadata; the reference itself is write-only. */
  @Field()
  get secretConfigured(): boolean {
    return (
      typeof this.secretRef === 'string' && this.secretRef.trim().length > 0
    );
  }

  @Field(() => String, { nullable: true })
  @Column({
    name: 'data_residency',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  dataResidency: string | null;

  @Field(() => String, { nullable: true })
  @Column({ name: 'region', type: 'varchar', length: 96, nullable: true })
  region: string | null;

  @Field(() => Int)
  @Column({ name: 'priority', type: 'int', default: 0 })
  priority: number;

  @Field(() => String)
  @Column({
    name: 'health_status',
    type: 'varchar',
    length: 32,
    default: 'unknown',
  })
  healthStatus: AIProviderHealthStatus;

  @Field(() => Date, { nullable: true })
  @Column({ name: 'last_health_check_at', type: 'timestamptz', nullable: true })
  lastHealthCheckAt: Date | null;

  @Field(() => String, { nullable: true })
  @Column({ name: 'health_message_masked', type: 'text', nullable: true })
  healthMessageMasked: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({
    name: 'metadata_masked',
    type: 'jsonb',
    nullable: true,
    default: () => "'{}'::jsonb",
  })
  metadataMasked: Record<string, unknown> | null;

  @Field(() => String, { nullable: true })
  @Column({ name: 'created_by', type: 'varchar', length: 96, nullable: true })
  createdBy: string | null;

  @Field(() => String, { nullable: true })
  @Column({ name: 'updated_by', type: 'varchar', length: 96, nullable: true })
  updatedBy: string | null;

  @Field()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
