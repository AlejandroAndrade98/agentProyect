import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityEventType,
  ConnectedAccountCapability,
  ConnectedAccountProvider,
  ConnectedAccountStatus,
  ConnectedAccountSyncStatus,
  ConnectedAccountOAuthStateStatus,
  EntityType,
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
];

const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
];

@Injectable()
export class ConnectedAccountsService {
  constructor(
  private readonly prisma: PrismaService,
  private readonly configService: ConfigService,
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

  return {
    authorizationUrl,
    provider: ConnectedAccountProvider.GOOGLE,
    capabilities,
    expiresAt,
  };
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

    return updatedAccount;
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