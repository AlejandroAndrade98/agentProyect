import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  CurrentUser,
  JwtAccessPayload,
} from '../interfaces/current-user.interface';

import { OrganizationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type RequestWithUser = {
  headers: Record<string, string | string[] | undefined>;
  user?: CurrentUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

async canActivate(context: ExecutionContext): Promise<boolean> {
  const request = context.switchToHttp().getRequest<RequestWithUser>();
  const token = this.extractTokenFromHeader(request);

  if (!token) {
    throw new UnauthorizedException('Missing access token');
  }

  const secret = this.configService.get<string>('app.jwtAccessSecret');

  if (!secret) {
    throw new UnauthorizedException('JWT configuration is missing');
  }

  let payload: JwtAccessPayload;

  try {
    payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
      secret,
    });
  } catch {
    throw new UnauthorizedException('Invalid or expired access token');
  }

  if (!payload.sub || !payload.organizationId || !payload.role) {
    throw new UnauthorizedException('Invalid access token payload');
  }

  const user = await this.prisma.user.findFirst({
    where: {
      id: payload.sub,
      organizationId: payload.organizationId,
      isActive: true,
    },
    select: {
      id: true,
      organizationId: true,
      role: true,
      organization: {
        select: {
          status: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedException('User not found or inactive');
  }

  if (user.organization.deletedAt) {
    throw new UnauthorizedException('Organization not found');
  }

  if (user.organization.status === OrganizationStatus.SUSPENDED) {
    throw new ForbiddenException('Organization is suspended');
  }

  if (user.organization.status === OrganizationStatus.CANCELLED) {
    throw new ForbiddenException('Organization is cancelled');
  }

  request.user = {
    id: user.id,
    organizationId: user.organizationId,
    role: user.role,
  };

  return true;
}

  private extractTokenFromHeader(request: RequestWithUser): string | undefined {
    const authorization = request.headers.authorization;

    if (typeof authorization !== 'string') {
      return undefined;
    }

    const [type, token] = authorization.split(' ');

    return type === 'Bearer' && token ? token : undefined;
  }
}