/**
 * Playground module (spec hosted-playground). Registered unconditionally —
 * runtime gating happens inside the controller (404 unless
 * PLAYGROUND_PROFILE=true) so a single image carries both personalities.
 * Global so the runtime resolvers can consult the session registry without
 * an import cycle.
 */
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Agent } from '../../modules/agent/entities/agent.entity';
import { AgentExecution } from '../../modules/agent-runtime/entities/agent-execution.entity';
import { ApprovalInstance } from '../../modules/approval/entities/approval-instance.entity';
import { GuardrailLog } from '../../modules/guardrail/entities/guardrail-log.entity';
import { ObjectMetadata } from '../../modules/object-metadata/entities/object-metadata.entity';
import { ObjectPermission } from '../../modules/permission/entities/object-permission.entity';
import { OutboxEvent } from '../../modules/outbox/entities/outbox-event.entity';
import { Role } from '../../modules/role/entities/role.entity';
import { User } from '../../modules/user/entities/user.entity';
import { Workspace } from '../../modules/workspace/entities/workspace.entity';
import { WorkspaceMember } from '../../modules/workspace/entities/workspace-member.entity';
import { CommunityAuthModule } from '../auth/community-auth.module';
import { PlaygroundController } from './community-playground.controller';
import { PlaygroundSessionReaper } from './community-playground-reaper.service';
import { PlaygroundSessionService } from './community-playground-session.service';
import { PlaygroundSessionRegistry } from './community-playground.registry';

@Global()
@Module({
  imports: [
    CommunityAuthModule,
    TypeOrmModule.forFeature([
      Workspace,
      Role,
      User,
      WorkspaceMember,
      ObjectMetadata,
      ObjectPermission,
      Agent,
      AgentExecution,
      ApprovalInstance,
      GuardrailLog,
      OutboxEvent,
    ]),
  ],
  controllers: [PlaygroundController],
  providers: [PlaygroundSessionRegistry, PlaygroundSessionService, PlaygroundSessionReaper],
  exports: [PlaygroundSessionRegistry],
})
export class CommunityPlaygroundModule {}
