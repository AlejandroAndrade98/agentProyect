import {
  BadRequestException,
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
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponse } from './interfaces/auth-response.interface';
import { SafeLoggerService } from '../common/observability/safe-logger.service';
import { EmailService } from '../email/email.service';

import { OrganizationStatus } from '@prisma/client';

type PasswordResetRequestContext = {
  ip?: string | null;
  userAgent?: string | null;
};

type ForgotPasswordResponse = {
  message: string;
  devResetUrl?: string;
};

const PASSWORD_RESET_GENERIC_MESSAGE =
  'If an account exists, password reset instructions will be sent.';
const PASSWORD_RESET_SUCCESS_MESSAGE = 'Password reset successful.';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly logger: SafeLoggerService,
    private readonly emailService: EmailService,
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

  async forgotPassword(
    dto: ForgotPasswordDto,
    context: PasswordResetRequestContext = {},
  ): Promise<ForgotPasswordResponse> {
    const email = dto.email.trim().toLowerCase();
    const emailHash = this.logger.hashIdentifier(email);
    const devMode = this.isAuthRecoveryDevModeEnabled();
    let rawToken: string | null = null;
    let tokenCreated = false;
    let userId: string | undefined;
    let organizationId: string | undefined;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        organization: {
          select: {
              id: true,
              name: true,
              status: true,
              deletedAt: true,
            },
        },
      },
    });

    if (user?.isActive && this.organizationAllowsPasswordReset(user.organization)) {
      rawToken = this.generatePasswordResetToken();
      const now = new Date();

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(rawToken),
          expiresAt: this.calculatePasswordResetExpiry(now),
          requestedIpHash: this.hashOptionalIdentifier(context.ip),
          requestedUserAgentHash: this.hashOptionalIdentifier(context.userAgent),
        },
      });

      tokenCreated = true;
      userId = user.id;
      organizationId = user.organizationId;
    }

    if (tokenCreated && rawToken && user) {
      await this.emailService.sendPasswordResetEmail({
        to: email,
        userName: user.name,
        resetUrl: this.buildPasswordResetUrl(rawToken),
        expiresInMinutes: this.getPasswordResetTtlMinutes(),
      });
    }

    this.logger.info('auth.password_reset.requested', {
      event: 'auth.password_reset.requested',
      emailHash,
      tokenCreated,
      userId,
      organizationId,
      deliveryMode: devMode ? 'dev_url' : 'provider_required',
    });

    if (!rawToken && devMode) {
      rawToken = this.generatePasswordResetToken();
    }

    return {
      message: PASSWORD_RESET_GENERIC_MESSAGE,
      ...(devMode && rawToken
        ? { devResetUrl: this.buildPasswordResetUrl(rawToken) }
        : {}),
    };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    context: PasswordResetRequestContext = {},
  ): Promise<{ message: string }> {
    const tokenHash = this.hashToken(dto.token);
    const now = new Date();

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            organization: {
              select: {
                id: true,
                status: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= now ||
      !resetToken.user?.isActive ||
      !this.organizationAllowsPasswordReset(resetToken.user.organization)
    ) {
      this.logger.warn('auth.password_reset.failed', {
        event: 'auth.password_reset.failed',
        reason: this.getPasswordResetFailureReason(resetToken, now),
        tokenHash: this.logger.hashIdentifier(tokenHash),
        userId: resetToken?.userId,
        organizationId: resetToken?.user?.organizationId,
      });
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    let revokedRefreshTokens = 0;

    await this.prisma.$transaction(async (tx) => {
      const updateTokenResult = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          usedAt: now,
          consumedIpHash: this.hashOptionalIdentifier(context.ip),
          consumedUserAgentHash: this.hashOptionalIdentifier(context.userAgent),
        },
      });

      if (updateTokenResult.count !== 1) {
        throw new BadRequestException('Invalid or expired reset link');
      }

      await tx.user.update({
        where: {
          id: resetToken.userId,
        },
        data: {
          passwordHash,
        },
      });

      const revokeResult = await tx.refreshToken.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      revokedRefreshTokens = revokeResult.count;

      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          id: {
            not: resetToken.id,
          },
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });
    });

    this.logger.info('auth.password_reset.completed', {
      event: 'auth.password_reset.completed',
      userId: resetToken.userId,
      organizationId: resetToken.user.organizationId,
      refreshTokensRevoked: revokedRefreshTokens,
    });

    return { message: PASSWORD_RESET_SUCCESS_MESSAGE };
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

  private organizationAllowsPasswordReset(organization: {
    status: OrganizationStatus;
    deletedAt: Date | null;
  }) {
    return (
      !organization.deletedAt &&
      organization.status !== OrganizationStatus.SUSPENDED &&
      organization.status !== OrganizationStatus.CANCELLED
    );
  }

  private getPasswordResetFailureReason(
    resetToken:
      | {
          usedAt: Date | null;
          expiresAt: Date;
          user?: {
            isActive: boolean;
            organization: {
              status: OrganizationStatus;
              deletedAt: Date | null;
            };
          } | null;
        }
      | null,
    now: Date,
  ) {
    if (!resetToken) {
      return 'not_found';
    }

    if (resetToken.usedAt) {
      return 'already_used';
    }

    if (resetToken.expiresAt <= now) {
      return 'expired';
    }

    if (!resetToken.user?.isActive) {
      return 'user_inactive';
    }

    if (!this.organizationAllowsPasswordReset(resetToken.user.organization)) {
      return 'organization_access_blocked';
    }

    return 'invalid';
  }

  private calculatePasswordResetExpiry(now: Date) {
    const ttlMinutes = this.getPasswordResetTtlMinutes();

    return new Date(now.getTime() + ttlMinutes * 60 * 1000);
  }

  private getPasswordResetTtlMinutes() {
    const configuredMinutes = Number(
      this.configService.get<number>('app.passwordResetTokenTtlMinutes') ?? 30,
    );

    return (
      Number.isFinite(configuredMinutes) && configuredMinutes > 0
        ? configuredMinutes
        : 30
    );
  }

  private buildPasswordResetUrl(token: string) {
    const configuredUrl =
      this.configService.get<string>('app.passwordResetPublicUrl') ||
      this.configService.get<string>('app.emailPublicAppUrl') ||
      this.configService.get<string>('app.frontendUrl') ||
      'http://localhost:3000';
    const url = new URL('/reset-password', configuredUrl);

    url.searchParams.set('token', token);
    return url.toString();
  }

  private isAuthRecoveryDevModeEnabled() {
    return (
      process.env.NODE_ENV !== 'production' &&
      (
        this.configService.get<string>('app.authRecoveryDevMode') ?? 'false'
      ).toLowerCase() === 'true'
    );
  }

  private generatePasswordResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashOptionalIdentifier(value: string | null | undefined) {
    return this.logger.hashIdentifier(value ?? null);
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
