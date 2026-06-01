import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponse } from './interfaces/auth-response.interface';
import { SafeLoggerService } from '../common/observability/safe-logger.service';

import { OrganizationStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly logger: SafeLoggerService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
        where: { email },
        include: {
          organization: {
            select: {
              status: true,
              deletedAt: true,
            },
          },
        },
      });

    if (!user || !user.isActive || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      this.logger.warn('auth.login.failed', {
        event: 'auth.login.failed',
        reason: 'invalid_credentials',
        emailHash: this.logger.hashIdentifier(email),
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    try {
      this.assertOrganizationAllowsAccess(user.organization);
    } catch (error) {
      this.logger.warn('auth.login.failed', {
        event: 'auth.login.failed',
        reason: 'organization_access_blocked',
        userId: user.id,
        organizationId: user.organizationId,
        ...this.logger.toErrorFields(error),
      });
      throw error;
    }

    const payload = {
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('app.jwtAccessSecret'),
      expiresIn: this.configService.get<string>('app.jwtAccessExpiresIn'),
    });

    const refreshToken = await this.createRefreshToken(user.id);

    this.logger.info('auth.login.success', {
      event: 'auth.login.success',
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponse> {
    const tokenHash = this.hashToken(dto.refreshToken);

    let result: {
      refreshToken: string;
      user: {
        id: string;
        email: string;
        name: string;
        role: string;
        organizationId: string;
      };
    };

    try {
      result = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (updateResult.count !== 1) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const tokenData = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: {
          user: {
            include: {
              organization: {
                select: {
                  status: true,
                  deletedAt: true,
                },
              },
            },
          },
        },
      });

      if (!tokenData || tokenData.expiresAt <= new Date() || !tokenData.user?.isActive) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      this.assertOrganizationAllowsAccess(tokenData.user.organization);
      const user = tokenData.user;
      const newRefreshToken = this.generateRefreshToken();

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(newRefreshToken),
          expiresAt: this.calculateExpiryDate(this.configService.get<string>('app.jwtRefreshExpiresIn')),
        },
      });

      return {
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        },
      };
      });
    } catch (error) {
      this.logger.warn('auth.refresh.failed', {
        event: 'auth.refresh.failed',
        ...this.logger.toErrorFields(error),
      });
      throw error;
    }

    const payload = {
      sub: result.user.id,
      organizationId: result.user.organizationId,
      role: result.user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('app.jwtAccessSecret'),
      expiresIn: this.configService.get<string>('app.jwtAccessExpiresIn'),
    });

    this.logger.info('auth.refresh.success', {
      event: 'auth.refresh.success',
      userId: result.user.id,
      organizationId: result.user.organizationId,
      role: result.user.role,
    });

    return {
      accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }

  async logout(dto: RefreshTokenDto): Promise<{ message: string }> {
    const tokenHash = this.hashToken(dto.refreshToken);

    const result = await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.info('auth.logout', {
      event: 'auth.logout',
      refreshTokensRevoked: result.count,
    });

    return { message: 'Logged out successfully' };
  }

  private assertOrganizationAllowsAccess(organization: {
  status: OrganizationStatus;
  deletedAt: Date | null;
    }) {
      if (organization.deletedAt) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (organization.status === OrganizationStatus.SUSPENDED) {
        throw new ForbiddenException('Organization is suspended');
      }

      if (organization.status === OrganizationStatus.CANCELLED) {
        throw new ForbiddenException('Organization is cancelled');
      }
    }

  private async createRefreshToken(userId: string): Promise<string> {
    const token = this.generateRefreshToken();
    const hashedToken = this.hashToken(token);
    const expiresAt = this.calculateExpiryDate(this.configService.get<string>('app.jwtRefreshExpiresIn'));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashedToken,
        expiresAt,
      },
    });

    return token;
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private calculateExpiryDate(duration: string | undefined): Date {
    if (!duration) {
      throw new Error('JWT_REFRESH_EXPIRES_IN is not defined in configuration');
    }

    const match = duration.match(/^(\d+)([mhd])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}. Expected format like '15m', '1h', or '7d'`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    let ms = 0;

    switch (unit) {
      case 'm': ms = value * 60 * 1000; break;
      case 'h': ms = value * 60 * 60 * 1000; break;
      case 'd': ms = value * 24 * 60 * 60 * 1000; break;
    }

    const expiryDate = new Date();
    expiryDate.setTime(expiryDate.getTime() + ms);
    return expiryDate;
  }
}
