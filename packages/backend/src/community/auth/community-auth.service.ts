import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';

import { User } from '../../modules/user/entities/user.entity';
import { WorkspaceMember } from '../../modules/workspace/entities/workspace-member.entity';

export interface CommunityPrincipal {
  id: string;
  roleId: string;
  orgNodeId?: string;
  defaultWorkspaceId: string;
}

@Injectable()
export class CommunityAuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private readonly members: Repository<WorkspaceMember>,
    private readonly jwt: JwtService,
  ) {}

  async signIn(username: string, password: string) {
    const user = await this.users.findOne({
      where: { username: username.trim() },
    });
    if (
      !user ||
      !user.isActive ||
      user.isFrozen ||
      user.isServiceAccount ||
      !user.hasPasswordSet ||
      !user.passwordHash ||
      !user.roleId ||
      !user.defaultWorkspaceId ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid username or password');
    }
    const member = await this.members.findOne({
      where: { userId: user.id, workspaceId: user.defaultWorkspaceId },
    });
    if (!member) {
      throw new UnauthorizedException('Workspace membership is required');
    }

    const expiresInSeconds = 30 * 60;
    const token = await this.jwt.signAsync({
      sub: user.id,
      workspaceId: user.defaultWorkspaceId,
      roleId: user.roleId,
      orgNodeId: user.orgNodeId,
      tokenUse: 'community_access',
    }, { expiresIn: expiresInSeconds });
    return {
      token,
      userId: user.id,
      workspaceId: user.defaultWorkspaceId,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async authenticate(token: string): Promise<CommunityPrincipal> {
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
    if (
      payload.tokenUse !== 'community_access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.workspaceId !== 'string'
    ) {
      throw new UnauthorizedException('Invalid access token');
    }
    const user = await this.users.findOne({ where: { id: payload.sub } });
    const member = await this.members.findOne({
      where: { userId: payload.sub, workspaceId: payload.workspaceId },
    });
    if (
      !user ||
      !member ||
      !user.isActive ||
      user.isFrozen ||
      user.isServiceAccount ||
      !user.roleId
    ) {
      throw new UnauthorizedException('Access token principal is unavailable');
    }
    return {
      id: user.id,
      roleId: user.roleId,
      orgNodeId: user.orgNodeId,
      defaultWorkspaceId: payload.workspaceId,
    };
  }
}
