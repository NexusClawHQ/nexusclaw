import { AgentExecution } from '../modules/agent-runtime/entities/agent-execution.entity';
import { ReactStep } from '../modules/agent-runtime/entities/react-step.entity';
import { ToolCallRecord } from '../modules/agent-runtime/entities/tool-call-record.entity';
import { Agent } from '../modules/agent/entities/agent.entity';
import { App } from '../modules/app-menu/entities/app.entity';
import { MenuItem } from '../modules/app-menu/entities/menu-item.entity';
import { ApprovalInstance } from '../modules/approval/entities/approval-instance.entity';
import { LoginIpRange } from '../modules/auth/entities/login-ip-range.entity';
import { ExecutionLog } from '../modules/execution-log/entities/execution-log.entity';
import { GuardrailLog } from '../modules/guardrail/entities/guardrail-log.entity';
import { OrgNode } from '../modules/org-hierarchy/entities/org-node.entity';
import { AppPermission } from '../modules/permission/entities/app-permission.entity';
import { NavItemPermission } from '../modules/permission/entities/nav-item-permission.entity';
import { PermissionAuditLog } from '../modules/permission/entities/permission-audit-log.entity';
import { RecordTypePermission } from '../modules/permission/entities/record-type-permission.entity';
import { TabPermission } from '../modules/permission/entities/tab-permission.entity';
import { Role } from '../modules/role/entities/role.entity';
import { User } from '../modules/user/entities/user.entity';
import { WorkspaceMember } from '../modules/workspace/entities/workspace-member.entity';
import { Workspace } from '../modules/workspace/entities/workspace.entity';
import { ObjectMetadata } from '../modules/object-metadata/entities/object-metadata.entity';
import { FieldMetadata } from '../modules/object-metadata/entities/field-metadata.entity';
import { ObjectPermission } from '../modules/permission/entities/object-permission.entity';
import { OutboxEvent } from '../modules/outbox/entities/outbox-event.entity';

/** Explicit relation-closed allowlist for the first Community vertical slice. */
export const COMMUNITY_ENTITY_MANIFEST: readonly Function[] = Object.freeze([
  AgentExecution,
  ReactStep,
  ToolCallRecord,
  Agent,
  App,
  MenuItem,
  ApprovalInstance,
  LoginIpRange,
  ExecutionLog,
  GuardrailLog,
  OrgNode,
  AppPermission,
  NavItemPermission,
  PermissionAuditLog,
  RecordTypePermission,
  TabPermission,
  Role,
  User,
  WorkspaceMember,
  Workspace,
  ObjectMetadata,
  FieldMetadata,
  ObjectPermission,
  OutboxEvent,
]);
