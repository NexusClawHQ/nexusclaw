import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
  BeforeInsert,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Role } from '../../role/entities/role.entity';
import { generateId } from '../../../common/utils/generate-id';

/**
 * LoginIpRange Entity
 *
 * Stores allowed IP address ranges for each Role (职权).
 * Supports both CIDR notation and start/end IP range modes.
 * Used to restrict login access to specific network environments.
 *
 * @see Requirements 1: 按职权配置登录 IP 范围限制
 */
@ObjectType()
@Entity('login_ip_ranges')
@Index('idx_login_ip_ranges_role_workspace', ['roleId', 'workspaceId'])
@Check('chk_ip_range_mode', `"cidr" IS NOT NULL OR ("startIp" IS NOT NULL AND "endIp" IS NOT NULL)`)
export class LoginIpRange {
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

  @Field()
  @Column({ type: 'uuid' })
  workspaceId: string;

  /**
   * Start IP address of the allowed range (IPv4 or IPv6)
   * Mutually exclusive with cidr — either cidr or startIp+endIp must be provided
   */
  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 45, nullable: true })
  startIp: string | null;

  /**
   * End IP address of the allowed range (IPv4 or IPv6)
   * Mutually exclusive with cidr — either cidr or startIp+endIp must be provided
   */
  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 45, nullable: true })
  endIp: string | null;

  /**
   * CIDR notation (e.g. 192.168.1.0/24)
   * Mutually exclusive with startIp/endIp — either cidr or startIp+endIp must be provided
   */
  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 49, nullable: true })
  cidr: string | null;

  /**
   * Human-readable description of this IP range entry
   */
  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Whether this IP range entry is active
   * @default true
   */
  @Field()
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // ============================================
  // Relationships
  // ============================================

  @Field(() => Role)
  @ManyToOne(() => Role, (role) => role.loginIpRanges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  // ============================================
  // Timestamps
  // ============================================

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
