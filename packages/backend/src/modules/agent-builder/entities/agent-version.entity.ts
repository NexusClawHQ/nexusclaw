import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
  BeforeInsert,
} from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';
import { AgentDefinition } from '../interfaces/agent-definition.interface';
import { generateId } from '../../../common/utils/generate-id';

/**
 * AgentVersion Entity
 *
 * Stores full JSONB snapshots of Agent definitions for version history and rollback.
 * Each save operation creates a new version with an incremented version number.
 */
@ObjectType('AgentVersion')
@Entity('agent_versions')
@Index('idx_agent_version_agent', ['agentId'])
@Index('idx_agent_version_workspace', ['workspaceId'])
@Index('UQ_agent_versions_workspace_id', ['workspaceId', 'id'], {
  unique: true,
})
@Index(
  'UQ_agent_versions_workspace_agent_id',
  ['workspaceId', 'agentId', 'id'],
  { unique: true },
)
@Unique(['agentId', 'versionNumber'])
export class AgentVersion {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Field(() => ID)
  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @Field(() => Int)
  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Field(() => GraphQLJSON)
  @Column({ type: 'jsonb' })
  snapshot: AgentDefinition;

  @Column({ name: 'agent_api_name', type: 'varchar', length: 160, nullable: true })
  agentApiName: string | null;

  @Column({ name: 'release_checksum', type: 'varchar', length: 71, nullable: true })
  releaseChecksum: string | null;

  @Column({ name: 'source_lock_digest', type: 'varchar', length: 71, nullable: true })
  sourceLockDigest: string | null;

  @Column({ name: 'employee_package_snapshot', type: 'jsonb', nullable: true })
  employeePackageSnapshot: unknown | null;

  @Field({ nullable: true })
  @Column({ name: 'change_summary', type: 'text', nullable: true })
  changeSummary: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
