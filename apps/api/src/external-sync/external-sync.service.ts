import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedAccountCapability,
  ConnectedAccountProvider,
  ConnectedAccountStatus,
  ConnectedAccountSyncStatus,
  Prisma,
} from '@prisma/client';

import type { CurrentUser as CurrentUserType } from '../auth/interfaces/current-user.interface';
import { ConnectedAccountTokenEncryptionService } from '../connected-accounts/connected-account-token-encryption.service';
import { PrismaService } from '../database/prisma.service';
import { QueryExternalCalendarEventsDto } from './dto/query-external-calendar-events.dto';
import { QueryExternalEmailMessagesDto } from './dto/query-external-email-messages.dto';

const GMAIL_MESSAGES_LIST_URL =
  'https://gmail.googleapis.com/gmail/v1/users/me/messages';

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const GMAIL_SYNC_MAX_RESULTS = 10;

const GMAIL_METADATA_HEADERS = ['From', 'To', 'Cc', 'Bcc', 'Subject', 'Date'];

type GmailMessagesListResponse = {
  messages?: Array<{
    id?: string;
    threadId?: string;
  }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailMessageMetadataResponse = {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{
      name?: string;
      value?: string;
    }>;
  };
  sizeEstimate?: number;
  historyId?: string;
};

type GoogleRefreshTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type ParsedEmailAddress = {
  email: string | null;
  name: string | null;
};

@Injectable()
export class ExternalSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly tokenEncryptionService: ConnectedAccountTokenEncryptionService,
  ) {}

  async syncGmailMessages(currentUser: CurrentUserType) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        provider: ConnectedAccountProvider.GOOGLE,
        status: ConnectedAccountStatus.CONNECTED,
        capabilities: {
          has: ConnectedAccountCapability.EMAIL,
        },
      },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        provider: true,
        email: true,
        encryptedAccessToken: true,
        encryptedRefreshToken: true,
        tokenExpiresAt: true,
      },
    });

    if (!account) {
      throw new BadRequestException(
        'Current user does not have a connected Google email account',
      );
    }

    if (!account.encryptedAccessToken || !account.encryptedRefreshToken) {
      throw new BadRequestException(
        'Connected account does not have OAuth tokens',
      );
    }

    await this.prisma.connectedAccountSyncState.updateMany({
      where: {
        organizationId: currentUser.organizationId,
        connectedAccountId: account.id,
        capability: ConnectedAccountCapability.EMAIL,
      },
      data: {
        status: ConnectedAccountSyncStatus.INITIAL_SYNC_RUNNING,
        lastSyncAttemptAt: new Date(),
        lastError: null,
      },
    });

    try {
      const accessToken = await this.getValidGoogleAccessToken(account);

      const listResponse = await this.fetchGmailMessagesList(accessToken);

      const messageRefs = listResponse.messages ?? [];
      const syncedAt = new Date();

      const messages = await Promise.all(
        messageRefs
          .filter((message) => Boolean(message.id))
          .map((message) =>
            this.fetchGmailMessageMetadata(accessToken, message.id as string),
          ),
      );

      let storedCount = 0;

      for (const message of messages) {
        if (!message.id) {
          continue;
        }

        await this.upsertExternalEmailMessage({
          organizationId: currentUser.organizationId,
          connectedAccountId: account.id,
          provider: account.provider,
          message,
          syncedAt,
        });

        storedCount += 1;
      }

      await this.prisma.connectedAccountSyncState.updateMany({
        where: {
          organizationId: currentUser.organizationId,
          connectedAccountId: account.id,
          capability: ConnectedAccountCapability.EMAIL,
        },
        data: {
          status: ConnectedAccountSyncStatus.ACTIVE,
          initialSyncCompletedAt: syncedAt,
          lastSuccessfulSyncAt: syncedAt,
          lastError: null,
        },
      });

      await this.prisma.connectedAccount.update({
        where: { id: account.id },
        data: { lastError: null },
      });

      return {
        connectedAccountId: account.id,
        provider: account.provider,
        email: account.email,
        messagesFetched: messageRefs.length,
        messagesStored: storedCount,
        nextPageToken: listResponse.nextPageToken ?? null,
        resultSizeEstimate: listResponse.resultSizeEstimate ?? null,
        syncedAt,
        bodyStored: false,
        aiAnalysisRun: false,
        crmRecordsCreated: false,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gmail sync failed';

      await this.prisma.connectedAccountSyncState.updateMany({
        where: {
          organizationId: currentUser.organizationId,
          connectedAccountId: account.id,
          capability: ConnectedAccountCapability.EMAIL,
        },
        data: {
          status: ConnectedAccountSyncStatus.ERROR,
          lastError: message,
        },
      });

      await this.prisma.connectedAccount.update({
        where: { id: account.id },
        data: { lastError: message },
      });

      throw new BadRequestException(message);
    }
  }

  async findEmailMessages(
    currentUser: CurrentUserType,
    query: QueryExternalEmailMessagesDto,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ExternalEmailMessageWhereInput = {
      organizationId: currentUser.organizationId,
      deletedAt: null,
      ...(query.connectedAccountId
        ? { connectedAccountId: query.connectedAccountId }
        : {}),
      ...(query.externalThreadId
        ? { externalThreadId: query.externalThreadId }
        : {}),
      ...(query.fromEmail
        ? {
            fromEmail: {
              contains: query.fromEmail,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.internalDateFrom || query.internalDateTo
        ? {
            internalDate: {
              ...(query.internalDateFrom
                ? { gte: new Date(query.internalDateFrom) }
                : {}),
              ...(query.internalDateTo
                ? { lte: new Date(query.internalDateTo) }
                : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              {
                subject: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                snippet: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                fromEmail: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                fromName: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.externalEmailMessage.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ internalDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          organizationId: true,
          connectedAccountId: true,
          provider: true,
          externalMessageId: true,
          externalThreadId: true,
          subject: true,
          snippet: true,
          fromEmail: true,
          fromName: true,
          toEmailsJson: true,
          ccEmailsJson: true,
          bccEmailsJson: true,
          labelIdsJson: true,
          internalDate: true,
          metadataJson: true,
          syncedAt: true,
          createdAt: true,
          updatedAt: true,
          connectedAccount: {
            select: {
              id: true,
              provider: true,
              email: true,
              displayName: true,
              status: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  role: true,
                  isActive: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.externalEmailMessage.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async findCalendarEvents(
    currentUser: CurrentUserType,
    query: QueryExternalCalendarEventsDto,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ExternalCalendarEventWhereInput = {
      organizationId: currentUser.organizationId,
      deletedAt: null,
      ...(query.connectedAccountId
        ? { connectedAccountId: query.connectedAccountId }
        : {}),
      ...(query.externalCalendarId
        ? { externalCalendarId: query.externalCalendarId }
        : {}),
      ...(query.startFrom || query.startTo
        ? {
            startAt: {
              ...(query.startFrom ? { gte: new Date(query.startFrom) } : {}),
              ...(query.startTo ? { lte: new Date(query.startTo) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              {
                summary: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                location: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                organizerEmail: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
              {
                organizerName: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.externalCalendarEvent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          organizationId: true,
          connectedAccountId: true,
          provider: true,
          externalCalendarId: true,
          externalEventId: true,
          iCalUid: true,
          status: true,
          summary: true,
          description: true,
          location: true,
          startAt: true,
          endAt: true,
          isAllDay: true,
          organizerEmail: true,
          organizerName: true,
          attendeesJson: true,
          htmlLink: true,
          metadataJson: true,
          syncedAt: true,
          createdAt: true,
          updatedAt: true,
          connectedAccount: {
            select: {
              id: true,
              provider: true,
              email: true,
              displayName: true,
              status: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  role: true,
                  isActive: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.externalCalendarEvent.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  private async getValidGoogleAccessToken(account: {
    id: string;
    encryptedAccessToken: string | null;
    encryptedRefreshToken: string | null;
    tokenExpiresAt: Date | null;
  }): Promise<string> {
    if (!account.encryptedAccessToken || !account.encryptedRefreshToken) {
      throw new ForbiddenException('Connected account OAuth tokens are missing');
    }

    const expiresAt = account.tokenExpiresAt?.getTime() ?? 0;
    const expiresSoon = expiresAt <= Date.now() + 60_000;

    if (!expiresSoon) {
      return this.tokenEncryptionService.decrypt(account.encryptedAccessToken);
    }

    const refreshToken = this.tokenEncryptionService.decrypt(
      account.encryptedRefreshToken,
    );

    const refreshed = await this.refreshGoogleAccessToken(refreshToken);

    if (!refreshed.access_token) {
      throw new InternalServerErrorException(
        'Google refresh token response did not include access_token',
      );
    }

    const encryptedAccessToken = this.tokenEncryptionService.encrypt(
      refreshed.access_token,
    );

    const tokenExpiresAt =
      typeof refreshed.expires_in === 'number'
        ? new Date(Date.now() + refreshed.expires_in * 1000)
        : null;

    await this.prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        encryptedAccessToken,
        tokenExpiresAt,
        tokenEncryptionVersion:
          this.tokenEncryptionService.getEncryptionVersion(),
        lastError: null,
      },
    });

    return refreshed.access_token;
  }

  private async refreshGoogleAccessToken(
    refreshToken: string,
  ): Promise<GoogleRefreshTokenResponse> {
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

    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
    body.set('refresh_token', refreshToken);
    body.set('grant_type', 'refresh_token');

    const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const data = (await response.json()) as GoogleRefreshTokenResponse;

    if (!response.ok || data.error) {
      throw new Error(
        data.error_description ||
          data.error ||
          'Google refresh token endpoint returned an error',
      );
    }

    return data;
  }

  private async fetchGmailMessagesList(
    accessToken: string,
  ): Promise<GmailMessagesListResponse> {
    const url = new URL(GMAIL_MESSAGES_LIST_URL);

    url.searchParams.set('maxResults', String(GMAIL_SYNC_MAX_RESULTS));
    url.searchParams.set('q', 'newer_than:30d');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = (await response.json()) as GmailMessagesListResponse;

    if (!response.ok) {
      throw new Error('Gmail messages list endpoint returned an error');
    }

    return data;
  }

  private async fetchGmailMessageMetadata(
    accessToken: string,
    messageId: string,
  ): Promise<GmailMessageMetadataResponse> {
    const url = new URL(`${GMAIL_MESSAGES_LIST_URL}/${messageId}`);

    url.searchParams.set('format', 'metadata');

    for (const header of GMAIL_METADATA_HEADERS) {
      url.searchParams.append('metadataHeaders', header);
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = (await response.json()) as GmailMessageMetadataResponse;

    if (!response.ok) {
      throw new Error('Gmail message metadata endpoint returned an error');
    }

    return data;
  }

  private async upsertExternalEmailMessage(params: {
    organizationId: string;
    connectedAccountId: string;
    provider: ConnectedAccountProvider;
    message: GmailMessageMetadataResponse;
    syncedAt: Date;
  }) {
    const headers = this.getGmailHeaders(params.message);
    const from = this.parseEmailAddress(headers.From);
    const to = this.parseEmailAddressList(headers.To);
    const cc = this.parseEmailAddressList(headers.Cc);
    const bcc = this.parseEmailAddressList(headers.Bcc);
    const internalDate = this.parseGmailInternalDate(
      params.message.internalDate,
    );

    await this.prisma.externalEmailMessage.upsert({
      where: {
        connectedAccountId_externalMessageId: {
          connectedAccountId: params.connectedAccountId,
          externalMessageId: params.message.id as string,
        },
      },
      create: {
        organizationId: params.organizationId,
        connectedAccountId: params.connectedAccountId,
        provider: params.provider,
        externalMessageId: params.message.id as string,
        externalThreadId: params.message.threadId ?? null,
        subject: headers.Subject ?? null,
        snippet: params.message.snippet ?? null,
        fromEmail: from.email,
        fromName: from.name,
        toEmailsJson: to as Prisma.InputJsonValue,
      ccEmailsJson:
        cc.length > 0 ? (cc as Prisma.InputJsonValue) : Prisma.DbNull,
      bccEmailsJson:
        bcc.length > 0 ? (bcc as Prisma.InputJsonValue) : Prisma.DbNull,
        labelIdsJson: (params.message.labelIds ?? []) as Prisma.InputJsonValue,
        internalDate,
        metadataJson: {
          gmailHistoryId: params.message.historyId ?? null,
          sizeEstimate: params.message.sizeEstimate ?? null,
          headersStored: GMAIL_METADATA_HEADERS,
          bodyStored: false,
        },
        syncedAt: params.syncedAt,
      },
      update: {
        externalThreadId: params.message.threadId ?? null,
        subject: headers.Subject ?? null,
        snippet: params.message.snippet ?? null,
        fromEmail: from.email,
        fromName: from.name,
        toEmailsJson: to as Prisma.InputJsonValue,
        ccEmailsJson:
          cc.length > 0 ? (cc as Prisma.InputJsonValue) : Prisma.DbNull,
        bccEmailsJson:
          bcc.length > 0 ? (bcc as Prisma.InputJsonValue) : Prisma.DbNull,
        labelIdsJson: (params.message.labelIds ?? []) as Prisma.InputJsonValue,
        internalDate,
        metadataJson: {
          gmailHistoryId: params.message.historyId ?? null,
          sizeEstimate: params.message.sizeEstimate ?? null,
          headersStored: GMAIL_METADATA_HEADERS,
          bodyStored: false,
        },
        syncedAt: params.syncedAt,
        deletedAt: null,
      },
    });
  }

  private getGmailHeaders(message: GmailMessageMetadataResponse) {
    const headers: Record<string, string | undefined> = {};

    for (const header of message.payload?.headers ?? []) {
      if (!header.name) {
        continue;
      }

      headers[header.name] = header.value;
    }

    return headers;
  }

  private parseGmailInternalDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    const asNumber = Number(value);

    if (!Number.isFinite(asNumber)) {
      return null;
    }

    return new Date(asNumber);
  }

  private parseEmailAddress(value?: string): ParsedEmailAddress {
    if (!value) {
      return {
        email: null,
        name: null,
      };
    }

    const match = value.match(/^(.*?)\s*<([^>]+)>$/);
    const rawName = match?.[1]?.trim().replace(/^"|"$/g, '') || null;
    const rawEmail = match?.[2]?.trim() || value.trim();

    return {
      email: rawEmail.toLowerCase(),
      name: rawName,
    };
  }

  private parseEmailAddressList(value?: string): ParsedEmailAddress[] {
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((item) => this.parseEmailAddress(item.trim()))
      .filter((item) => Boolean(item.email));
  }
}