import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ActivityEventType,
  ConnectedAccountCapability,
  ConnectedAccountOAuthStateStatus,
  ConnectedAccountProvider,
  ConnectedAccountStatus,
  ConnectedAccountSyncStatus,
  EntityType,
  OrganizationStatus,
  Prisma,
  Role,
  Source,
} from '@prisma/client';

import type { CurrentUser } from '../auth/interfaces/current-user.interface';
import { PrismaService } from '../database/prisma.service';
import { CreateDevConnectedAccountDto } from './dto/create-dev-connected-account.dto';
import { QueryConnectedAccountsDto } from './dto/query-connected-accounts.dto';

import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';

import { StartGoogleOAuthDto } from './dto/start-google-oauth.dto';

import { ConnectedAccountTokenEncryptionService } from './connected-account-token-encryption.service';
import { GoogleOAuthCallbackDto } from './dto/google-oauth-callback.dto';
import { SafeLoggerService } from '../common/observability/safe-logger.service';

const connectedAccountSelect = {
  id: true,
  organizationId: true,
  userId: true,
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  },
  provider: true,
  email: true,
  displayName: true,
  externalAccountId: true,
  status: true,
  capabilities: true,
  scopesJson: true,
  tokenExpiresAt: true,
  connectedAt: true,
  disconnectRequestedAt: true,
  disconnectedAt: true,
  revokedAt: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
  syncStates: {
    select: {
      id: true,
      capability: true,
      status: true,
      syncFrom: true,
      initialSyncCompletedAt: true,
      lastSyncAttemptAt: true,
      lastSuccessfulSyncAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      capability: 'asc',
    },
  },
} satisfies Prisma.ConnectedAccountSelect;

const GOOGLE_OAUTH_AUTHORIZATION_URL =
  'https://accounts.google.com/o/oauth2/v2/auth';

const OAUTH_STATE_EXPIRATION_MINUTES = 10;

const GOOGLE_BASE_SCOPES = ['openid', 'email', 'profile'];

const GOOGLE_EMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
];

const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
];

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const GOOGLE_OAUTH_USERINFO_URL =
  'https://openidconnect.googleapis.com/v1/userinfo';

  type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfoResponse = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

@Injectable()
export class ConnectedAccountsService {
  constructor(
  private readonly prisma: PrismaService,
  private readonly configService: ConfigService,
  private readonly tokenEncryptionService: ConnectedAccountTokenEncryptionService,
  private readonly logger: SafeLoggerService,
  ) {}

  async findAll(currentUser: CurrentUser, query: QueryConnectedAccountsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ConnectedAccountWhereInput = {
      organizationId: currentUser.organizationId,
    };

    if (!this.canManageOrganizationAccounts(currentUser)) {
      where.userId = currentUser.id;
    } else if (query.userId) {
      await this.ensureUserBelongsToOrganization(
        query.userId,
        currentUser.organizationId,
      );

      where.userId = query.userId;
    }

    if (query.provider) {
      where.provider = query.provider;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.capability) {
      where.capabilities = {
        has: query.capability,
      };
    }

    if (query.search) {
      where.OR = [
        {
          email: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          displayName: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.connectedAccount.findMany({
        where,
        select: connectedAccountSelect,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      this.prisma.connectedAccount.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(currentUser: CurrentUser, id: string) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
      select: connectedAccountSelect,
    });

    if (!account) {
      throw new NotFoundException('Connected account not found');
    }

    this.ensureCanAccessAccount(currentUser, account.userId);

    return account;
  }

  async startGoogleOAuth(
  currentUser: CurrentUser,
  query: StartGoogleOAuthDto,
) {
  if (currentUser.role === Role.VIEWER) {
    throw new ForbiddenException('Viewer users cannot connect accounts');
  }

  const existingAccount = await this.prisma.connectedAccount.findUnique({
    where: {
      organizationId_userId: {
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (existingAccount) {
    throw new ConflictException('User already has a connected account');
  }

  const clientId = this.configService.get<string>('app.googleOAuthClientId');
  const redirectUri = this.configService.get<string>(
    'app.googleOAuthRedirectUri',
  );

  if (!clientId || !redirectUri) {
    throw new InternalServerErrorException(
      'Google OAuth configuration is missing',
    );
  }

  const capabilities = this.normalizeOAuthCapabilities(query.capabilities);
  const scopes = this.getGoogleOAuthScopes(capabilities);
  const rawState = this.generateOAuthState();
  const stateHash = this.hashOAuthState(rawState);
  const expiresAt = this.getOAuthStateExpirationDate();

  await this.prisma.$transaction(async (tx) => {
    await tx.connectedAccountOAuthState.updateMany({
      where: {
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        provider: ConnectedAccountProvider.GOOGLE,
        status: ConnectedAccountOAuthStateStatus.PENDING,
      },
      data: {
        status: ConnectedAccountOAuthStateStatus.CANCELLED,
      },
    });

    await tx.connectedAccountOAuthState.create({
      data: {
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        provider: ConnectedAccountProvider.GOOGLE,
        capabilities,
        status: ConnectedAccountOAuthStateStatus.PENDING,
        stateHash,
        redirectUri,
        scopesJson: {
          scopes,
          accessType: 'offline',
          includeGrantedScopes: true,
          prompt: 'consent',
        },
        expiresAt,
        tokenEncryptionVersion:
          this.configService.get<string>(
            'app.connectedAccountTokenEncryptionVersion',
          ) || 'v1',
      },
    });
  });

  const authorizationUrl = this.buildGoogleAuthorizationUrl({
    clientId,
    redirectUri,
    scopes,
    state: rawState,
  });

  this.logger.info('oauth.google.start', {
    event: 'oauth.google.start',
    organizationId: currentUser.organizationId,
    userId: currentUser.id,
    capabilities,
    scopeCount: scopes.length,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    authorizationUrl,
    provider: ConnectedAccountProvider.GOOGLE,
    capabilities,
    expiresAt,
  };
}

async handleGoogleOAuthCallback(query: GoogleOAuthCallbackDto) {
  if (!query.state) {
    this.logger.warn('oauth.google.callback.failed', {
      event: 'oauth.google.callback.failed',
      reason: 'missing_state',
    });
    throw new BadRequestException('Missing OAuth state');
  }

  const stateHash = this.hashOAuthState(query.state);

  if (query.error) {
    await this.markOAuthStateErrorByHash(stateHash, {
      errorCode: query.error,
      errorMessage:
        query.error_description || 'Google OAuth authorization failed',
    });

    this.logger.warn('oauth.google.callback.failed', {
      event: 'oauth.google.callback.failed',
      reason: 'provider_error',
      errorCode: query.error,
      stateHashPrefix: stateHash.slice(0, 12),
    });

    throw new BadRequestException('Google OAuth authorization was not completed');
  }

  if (!query.code) {
    this.logger.warn('oauth.google.callback.failed', {
      event: 'oauth.google.callback.failed',
      reason: 'missing_code',
      stateHashPrefix: stateHash.slice(0, 12),
    });
    throw new BadRequestException('Missing OAuth authorization code');
  }

  const oauthState = await this.prisma.connectedAccountOAuthState.findUnique({
    where: {
      stateHash,
    },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      provider: true,
      capabilities: true,
      status: true,
      redirectUri: true,
      expiresAt: true,
      usedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          isActive: true,
          deletedAt: true,
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

  if (!oauthState || oauthState.provider !== ConnectedAccountProvider.GOOGLE) {
    this.logger.warn('oauth.google.callback.failed', {
      event: 'oauth.google.callback.failed',
      reason: 'invalid_state',
      stateHashPrefix: stateHash.slice(0, 12),
    });
    throw new BadRequestException('Invalid OAuth state');
  }

  if (
    oauthState.status !== ConnectedAccountOAuthStateStatus.PENDING ||
    oauthState.usedAt
  ) {
    this.logger.warn('oauth.google.callback.failed', {
      event: 'oauth.google.callback.failed',
      reason: 'state_already_used',
      organizationId: oauthState.organizationId,
      userId: oauthState.userId,
      stateStatus: oauthState.status,
    });
    throw new BadRequestException('OAuth state has already been used');
  }

  if (oauthState.expiresAt.getTime() < Date.now()) {
    await this.prisma.connectedAccountOAuthState.update({
      where: {
        id: oauthState.id,
      },
      data: {
        status: ConnectedAccountOAuthStateStatus.EXPIRED,
        errorCode: 'OAUTH_STATE_EXPIRED',
        errorMessage: 'OAuth state expired before callback was completed',
      },
    });

    this.logger.warn('oauth.google.callback.failed', {
      event: 'oauth.google.callback.failed',
      reason: 'state_expired',
      organizationId: oauthState.organizationId,
      userId: oauthState.userId,
    });

    throw new BadRequestException('OAuth state has expired');
  }

  if (!oauthState.user.isActive || oauthState.user.deletedAt) {
    throw new UnauthorizedException('User not found or inactive');
  }

  if (oauthState.user.organization.deletedAt) {
    throw new UnauthorizedException('Organization not found');
  }

  if (oauthState.user.organization.status === OrganizationStatus.SUSPENDED) {
    throw new ForbiddenException('Organization is suspended');
  }

  if (oauthState.user.organization.status === OrganizationStatus.CANCELLED) {
    throw new ForbiddenException('Organization is cancelled');
  }

  const existingAccount = await this.prisma.connectedAccount.findUnique({
    where: {
      organizationId_userId: {
        organizationId: oauthState.organizationId,
        userId: oauthState.userId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingAccount) {
    await this.prisma.connectedAccountOAuthState.update({
      where: {
        id: oauthState.id,
      },
      data: {
        status: ConnectedAccountOAuthStateStatus.CANCELLED,
        errorCode: 'CONNECTED_ACCOUNT_ALREADY_EXISTS',
        errorMessage: 'User already has a connected account',
      },
    });

    throw new ConflictException('User already has a connected account');
  }

  let tokenResponse: GoogleTokenResponse;
  let userInfo: GoogleUserInfoResponse;

  try {
    tokenResponse = await this.exchangeGoogleAuthorizationCode({
      code: query.code,
      redirectUri: oauthState.redirectUri,
    });

    if (!tokenResponse.access_token) {
      throw new Error('Google token response did not include access_token');
    }

    if (!tokenResponse.refresh_token) {
      throw new Error('Google token response did not include refresh_token');
    }

    userInfo = await this.fetchGoogleUserInfo(tokenResponse.access_token);

    if (!userInfo.sub || !userInfo.email) {
      throw new Error('Google userinfo response is missing sub or email');
    }
  } catch (error) {
    await this.prisma.connectedAccountOAuthState.update({
      where: {
        id: oauthState.id,
      },
      data: {
        status: ConnectedAccountOAuthStateStatus.ERROR,
        errorCode: 'GOOGLE_OAUTH_TOKEN_EXCHANGE_FAILED',
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Google OAuth token exchange failed',
      },
    });

    this.logger.warn('oauth.google.callback.failed', {
      event: 'oauth.google.callback.failed',
      reason: 'token_exchange_failed',
      organizationId: oauthState.organizationId,
      userId: oauthState.userId,
      ...this.logger.toErrorFields(error),
    });

    throw new BadRequestException('Google OAuth token exchange failed');
  }

  const googleEmail = userInfo.email.toLowerCase().trim();
  const googleDisplayName = userInfo.name || googleEmail;
  const googleExternalAccountId = userInfo.sub;
  const googleEmailVerified = userInfo.email_verified ?? null;

  const encryptedAccessToken = this.tokenEncryptionService.encrypt(
    tokenResponse.access_token,
  );

  const encryptedRefreshToken = this.tokenEncryptionService.encrypt(
    tokenResponse.refresh_token,
  );

  const tokenExpiresAt =
    typeof tokenResponse.expires_in === 'number'
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

  const syncFrom = this.getInitialSyncFromDate();
  const tokenEncryptionVersion =
    this.tokenEncryptionService.getEncryptionVersion();

  const account = await this.prisma.$transaction(async (tx) => {
    const existingInsideTransaction = await tx.connectedAccount.findUnique({
      where: {
        organizationId_userId: {
          organizationId: oauthState.organizationId,
          userId: oauthState.userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingInsideTransaction) {
      throw new ConflictException('User already has a connected account');
    }

    const createdAccount = await tx.connectedAccount.create({
      data: {
        organizationId: oauthState.organizationId,
        userId: oauthState.userId,
        provider: ConnectedAccountProvider.GOOGLE,
        email: googleEmail,
        displayName: googleDisplayName,
        externalAccountId: googleExternalAccountId,
        status: ConnectedAccountStatus.CONNECTED,
        capabilities: oauthState.capabilities,
        scopesJson: {
          scopes: tokenResponse.scope
            ? tokenResponse.scope.split(' ')
            : undefined,
          tokenType: tokenResponse.token_type,
          emailVerified: googleEmailVerified,
          provider: ConnectedAccountProvider.GOOGLE,
        },
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        tokenEncryptionVersion,
        connectedAt: new Date(),
        syncStates: {
          create: oauthState.capabilities.map((capability) => ({
            organizationId: oauthState.organizationId,
            capability,
            status: ConnectedAccountSyncStatus.INITIAL_SYNC_PENDING,
            syncFrom,
          })),
        },
      },
      select: connectedAccountSelect,
    });

    await tx.connectedAccountOAuthState.update({
      where: {
        id: oauthState.id,
      },
      data: {
        status: ConnectedAccountOAuthStateStatus.USED,
        usedAt: new Date(),
      },
    });

    await this.createActivityEvent(tx, {
      organizationId: oauthState.organizationId,
      actorUserId: oauthState.userId,
      accountId: createdAccount.id,
      type: ActivityEventType.CONNECTED_ACCOUNT_CONNECTED,
      title: 'Google account connected',
      description: `Google account connected for ${createdAccount.email}`,
      metadataJson: {
        provider: ConnectedAccountProvider.GOOGLE,
        email: createdAccount.email,
        capabilities: createdAccount.capabilities,
        oauthImplemented: true,
        syncImplemented: false,
        initialSyncWindowDays: 30,
        hasTokens: true,
      },
    });

    return createdAccount;
  });

  this.logger.info('oauth.google.callback.success', {
    event: 'oauth.google.callback.success',
    organizationId: account.organizationId,
    userId: account.userId,
    connectedAccountId: account.id,
    capabilities: account.capabilities,
  });

  return account;
}

  async devConnect(
    currentUser: CurrentUser,
    dto: CreateDevConnectedAccountDto,
  ) {
    if (currentUser.role === Role.VIEWER) {
      throw new ForbiddenException('Viewer users cannot connect accounts');
    }

    const existingAccount = await this.prisma.connectedAccount.findUnique({
      where: {
        organizationId_userId: {
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (existingAccount) {
      throw new ConflictException('User already has a connected account');
    }

    const capabilities = this.normalizeCapabilities(dto.capabilities);
    const syncFrom = this.getInitialSyncFromDate();

    const account = await this.prisma.$transaction(async (tx) => {
      const createdAccount = await tx.connectedAccount.create({
        data: {
          organizationId: currentUser.organizationId,
          userId: currentUser.id,
          provider: dto.provider,
          email: dto.email.toLowerCase().trim(),
          displayName: dto.displayName?.trim() || null,
          externalAccountId: dto.externalAccountId?.trim() || null,
          status: ConnectedAccountStatus.CONNECTED,
          capabilities,
          scopesJson: {
            mode: 'development',
            note: 'Simulated connected account. OAuth is not implemented yet.',
          },
          encryptedAccessToken: null,
          encryptedRefreshToken: null,
          tokenExpiresAt: null,
          tokenEncryptionVersion: null,
          connectedAt: new Date(),
          syncStates: {
            create: capabilities.map((capability) => ({
              organizationId: currentUser.organizationId,
              capability,
              status: ConnectedAccountSyncStatus.INITIAL_SYNC_PENDING,
              syncFrom,
            })),
          },
        },
        select: connectedAccountSelect,
      });

      await this.createActivityEvent(tx, {
        organizationId: currentUser.organizationId,
        actorUserId: currentUser.id,
        accountId: createdAccount.id,
        type: ActivityEventType.CONNECTED_ACCOUNT_CONNECTED,
        title: 'Connected account added',
        description: `${createdAccount.provider} account connected for ${createdAccount.email}`,
        metadataJson: {
          provider: createdAccount.provider,
          email: createdAccount.email,
          capabilities,
          mode: 'development',
          hasTokens: false,
          oauthImplemented: false,
          syncImplemented: false,
          initialSyncWindowDays: 30,
        },
      });

      return createdAccount;
    });

    return account;
  }

  async requestDisconnect(currentUser: CurrentUser, id: string) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        provider: true,
        email: true,
      },
    });

    if (!account) {
      throw new NotFoundException('Connected account not found');
    }

    this.ensureCanAccessAccount(currentUser, account.userId);

    if (
      account.status === ConnectedAccountStatus.DISCONNECTED ||
      account.status === ConnectedAccountStatus.REVOKED
    ) {
      throw new ConflictException('Connected account is already disconnected');
    }

    const updatedAccount = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.connectedAccount.update({
        where: {
          id: account.id,
        },
        data: {
          status: ConnectedAccountStatus.DISCONNECT_REQUESTED,
          disconnectRequestedAt: new Date(),
        },
        select: connectedAccountSelect,
      });

      await this.createActivityEvent(tx, {
        organizationId: currentUser.organizationId,
        actorUserId: currentUser.id,
        accountId: updated.id,
        type: ActivityEventType.CONNECTED_ACCOUNT_DISCONNECT_REQUESTED,
        title: 'Connected account disconnect requested',
        description: `${updated.provider} account disconnect requested for ${updated.email}`,
        metadataJson: {
          provider: updated.provider,
          email: updated.email,
          requestedByUserId: currentUser.id,
        },
      });

      return updated;
    });

    this.logger.info('connected_account.disconnect_requested', {
      event: 'connected_account.disconnect_requested',
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      connectedAccountId: updatedAccount.id,
      provider: updatedAccount.provider,
    });

    return updatedAccount;
  }

  async disconnect(currentUser: CurrentUser, id: string) {
    if (!this.canManageOrganizationAccounts(currentUser)) {
      throw new ForbiddenException('Only organization admins can disconnect accounts');
    }

    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
      },
      select: {
        id: true,
        status: true,
        provider: true,
        email: true,
      },
    });

    if (!account) {
      throw new NotFoundException('Connected account not found');
    }

    if (
      account.status === ConnectedAccountStatus.DISCONNECTED ||
      account.status === ConnectedAccountStatus.REVOKED
    ) {
      throw new ConflictException('Connected account is already disconnected');
    }

    const updatedAccount = await this.prisma.$transaction(async (tx) => {
      await tx.connectedAccountSyncState.updateMany({
        where: {
          connectedAccountId: account.id,
          organizationId: currentUser.organizationId,
        },
        data: {
          status: ConnectedAccountSyncStatus.PAUSED,
          lastError: null,
        },
      });

      const updated = await tx.connectedAccount.update({
        where: {
          id: account.id,
        },
        data: {
          status: ConnectedAccountStatus.DISCONNECTED,
          encryptedAccessToken: null,
          encryptedRefreshToken: null,
          tokenExpiresAt: null,
          disconnectedAt: new Date(),
          lastError: null,
        },
        select: connectedAccountSelect,
      });

      await this.createActivityEvent(tx, {
        organizationId: currentUser.organizationId,
        actorUserId: currentUser.id,
        accountId: updated.id,
        type: ActivityEventType.CONNECTED_ACCOUNT_DISCONNECTED,
        title: 'Connected account disconnected',
        description: `${updated.provider} account disconnected for ${updated.email}`,
        metadataJson: {
          provider: updated.provider,
          email: updated.email,
          disconnectedByUserId: currentUser.id,
          tokensCleared: true,
        },
      });

      return updated;
    });

    this.logger.info('connected_account.disconnected', {
      event: 'connected_account.disconnected',
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      connectedAccountId: updatedAccount.id,
      provider: updatedAccount.provider,
      tokensCleared: true,
    });

    return updatedAccount;
  }

  private async exchangeGoogleAuthorizationCode(params: {
  code: string;
  redirectUri: string;
}): Promise<GoogleTokenResponse> {
  const clientId = this.configService.get<string>('app.googleOAuthClientId');
  const clientSecret = this.configService.get<string>(
    'app.googleOAuthClientSecret',
  );

  if (!clientId || !clientSecret) {
    throw new InternalServerErrorException(
      'Google OAuth configuration is missing',
    );
  }

  const body = new URLSearchParams();

  body.set('code', params.code);
  body.set('client_id', clientId);
  body.set('client_secret', clientSecret);
  body.set('redirect_uri', params.redirectUri);
  body.set('grant_type', 'authorization_code');

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const tokenResponse = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || tokenResponse.error) {
    throw new Error(
      tokenResponse.error_description ||
        tokenResponse.error ||
        'Google token endpoint returned an error',
    );
  }

  return tokenResponse;
}

private async fetchGoogleUserInfo(
  accessToken: string,
): Promise<GoogleUserInfoResponse> {
  const response = await fetch(GOOGLE_OAUTH_USERINFO_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const userInfo = (await response.json()) as GoogleUserInfoResponse;

  if (!response.ok) {
    throw new Error('Google userinfo endpoint returned an error');
  }

  return userInfo;
}

private async markOAuthStateErrorByHash(
  stateHash: string,
  params: {
    errorCode: string;
    errorMessage: string;
  },
) {
  await this.prisma.connectedAccountOAuthState.updateMany({
    where: {
      stateHash,
      status: ConnectedAccountOAuthStateStatus.PENDING,
    },
    data: {
      status: ConnectedAccountOAuthStateStatus.ERROR,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
    },
  });
}

  private normalizeOAuthCapabilities(
  capabilities?: ConnectedAccountCapability[],
): ConnectedAccountCapability[] {
  const normalized = capabilities?.length
    ? capabilities
    : [
        ConnectedAccountCapability.EMAIL,
        ConnectedAccountCapability.CALENDAR,
      ];

  return Array.from(new Set(normalized));
}

private getGoogleOAuthScopes(
  capabilities: ConnectedAccountCapability[],
): string[] {
  const scopes = [...GOOGLE_BASE_SCOPES];

  if (capabilities.includes(ConnectedAccountCapability.EMAIL)) {
    scopes.push(...GOOGLE_EMAIL_SCOPES);
  }

  if (capabilities.includes(ConnectedAccountCapability.CALENDAR)) {
    scopes.push(...GOOGLE_CALENDAR_SCOPES);
  }

  return scopes;
}

private generateOAuthState(): string {
  return randomBytes(32).toString('base64url');
}

private hashOAuthState(rawState: string): string {
  return createHash('sha256').update(rawState).digest('hex');
}

private getOAuthStateExpirationDate(): Date {
  return new Date(Date.now() + OAUTH_STATE_EXPIRATION_MINUTES * 60 * 1000);
}

private buildGoogleAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}): string {
  const url = new URL(GOOGLE_OAUTH_AUTHORIZATION_URL);

  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', params.scopes.join(' '));
  url.searchParams.set('state', params.state);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');

  return url.toString();
}

  private normalizeCapabilities(
    capabilities?: ConnectedAccountCapability[],
  ): ConnectedAccountCapability[] {
    const normalized = capabilities?.length
      ? capabilities
      : [ConnectedAccountCapability.EMAIL];

    return Array.from(new Set(normalized));
  }

  private getInitialSyncFromDate(): Date {
    const syncFrom = new Date();
    syncFrom.setDate(syncFrom.getDate() - 30);
    return syncFrom;
  }

    private canManageOrganizationAccounts(currentUser: CurrentUser): boolean {
    return (
        currentUser.role === Role.SUPER_ADMIN ||
        currentUser.role === Role.OWNER ||
        currentUser.role === Role.ADMIN
    );
    }

  private ensureCanAccessAccount(currentUser: CurrentUser, accountUserId: string) {
    if (this.canManageOrganizationAccounts(currentUser)) {
      return;
    }

    if (accountUserId !== currentUser.id) {
      throw new ForbiddenException('Cannot access another user connected account');
    }
  }

  private async ensureUserBelongsToOrganization(
    userId: string,
    organizationId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in current organization');
    }
  }

  private async createActivityEvent(
    tx: Prisma.TransactionClient,
    params: {
      organizationId: string;
      actorUserId: string;
      accountId: string;
      type: ActivityEventType;
      title: string;
      description: string;
      metadataJson: Prisma.InputJsonValue;
    },
  ) {
    await tx.activityEvent.create({
      data: {
        organizationId: params.organizationId,
        type: params.type,
        entityType: EntityType.CONNECTED_ACCOUNT,
        entityId: params.accountId,
        title: params.title,
        description: params.description,
        source: Source.MANUAL,
        actorUserId: params.actorUserId,
        metadataJson: params.metadataJson,
      },
    });
  }
}
