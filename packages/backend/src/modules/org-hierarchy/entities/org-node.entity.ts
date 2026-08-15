import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { generateId } from '../../../common/utils/generate-id';

/**
 * OrgNode Entity
 *
 * Represents a node in the organization hierarchy tree structure.
 * Supports unlimited levels of nesting through self-referencing parent-child relationships.
 *
 * @see Requirement 7: 组织架构管理
 * - THE OrgHierarchy SHALL 支持创建多级树形结构
 * - EACH OrgNode SHALL 包含：名称、上级节点、关联用户
 * - THE System SHALL 支持拖拽调整组织结构
 */
@ObjectType()
@Entity('org_nodes')
@Index('IDX_ORG_NODE_WORKSPACE_ID', ['workspaceId'])
@Index('IDX_ORG_NODE_PARENT_ID', ['parentId'])
@Index('IDX_ORG_NODE_API_NAME_WORKSPACE_ID_UNIQUE', ['apiName', 'workspaceId'], { unique: true })
@Index('IDX_ORG_NODE_WORKSPACE_PARENT_POSITION', ['workspaceId', 'parentId', 'position'])
export class OrgNode {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  /**
   * The workspace this organization node belongs to
   */
  @Field()
  @Column({ type: 'uuid' })
  workspaceId: string;

  /**
   * Organization node label (display name, can be changed)
   * 组织节点标签（显示名称，可修改）
   */
  @Field()
  @Column({ type: 'varchar', length: 255 })
  label: string;

  /**
   * Organization node API name (unique identifier within workspace, can be changed but must remain unique)
   * 组织节点 API 名称（工作空间内唯一标识符，可修改但必须保持唯一）
   * Format: PascalCase, e.g., HeadOffice, SalesDepartment
   */
  @Field()
  @Column({ type: 'varchar', length: 255 })
  apiName: string;

  /**
   * @deprecated Use 'label' instead. Kept for backward compatibility.
   * Display name of the organization node
   */
  @Field()
  @Column({ type: 'varchar', length: 255 })
  name: string;

  /**
   * Reference to the parent node (null for root nodes)
   */
  @Field(() => String, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  /**
   * Position for ordering siblings within the same parent
   * Used for drag-and-drop reordering
   * @default 0
   */
  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  position: number;

  /**
   * Self-referencing relationship to parent node
   * Enables tree traversal upward
   */
  @Field(() => OrgNode, { nullable: true })
  @ManyToOne(() => OrgNode, (node) => node.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parentId' })
  parent: OrgNode | null;

  /**
   * Self-referencing relationship to child nodes
   * Enables tree traversal downward
   */
  @Field(() => [OrgNode], { nullable: true })
  @OneToMany(() => OrgNode, (node) => node.parent)
  children: OrgNode[];

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
