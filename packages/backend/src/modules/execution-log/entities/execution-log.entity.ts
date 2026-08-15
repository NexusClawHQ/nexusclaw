import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { generateId } from '../../../common/utils/generate-id';
import {
  type ExtensionDiagnosticRecord,
  type ExtensionExecutionRecord,
} from '../contracts/extension-execution-record';

export enum ExecutionLogType {
  FUNCTION = 'function',
  TRIGGER = 'trigger',
  EVENT = 'event',
}

export enum ExecutionLogStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  TIMEOUT = 'timeout',
}

@Entity('execution_logs')
@Index(['workspaceId', 'type'])
@Index(['workspaceId', 'sourceId'])
@Index(['workspaceId', 'executedAt'])
export class ExecutionLog {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Column()
  @Index()
  workspaceId: string;

  @Column({ type: 'enum', enum: ExecutionLogType })
  type: ExecutionLogType;

  @Column()
  sourceId: string;

  @Column()
  sourceName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  artifactApiName?: string | null;

  @Column({ type: 'enum', enum: ExecutionLogStatus })
  status: ExecutionLogStatus;

  @Column({ type: 'int' })
  duration: number; // ms

  @Column({ type: 'jsonb', nullable: true })
  input?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  output?: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  logs?: string;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  packageName?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  packageVersion?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  providerId?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  policyId?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  traceId?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  correlationId?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  sourceHash?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  compiledHash?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  governanceRecord?: ExtensionExecutionRecord | null;

  @Column({ type: 'jsonb', nullable: true })
  diagnosticRecord?: ExtensionDiagnosticRecord | null;

  @CreateDateColumn()
  executedAt: Date;

  @Column()
  executedBy: string;
}
