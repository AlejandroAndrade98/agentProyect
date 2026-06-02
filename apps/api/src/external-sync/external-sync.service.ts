import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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
import { SafeLoggerService } from '../common/observability/safe-logger.service';
import { ConnectedAccountTokenEncryptionService } from '../connected-accounts/connected-account-token-encryption.service';
import { PrismaService } from '../database/prisma.service';
import { DismissExternalEmailMessageDto } from './dto/dismiss-external-email-message.dto';
import { GmailSearchPreviewDto } from './dto/gmail-search-preview.dto';
import { ImportSelectedEmailMessagesDto } from './dto/import-selected-email-messages.dto';
import { QueryExternalCalendarEventsDto } from './dto/query-external-calendar-events.dto';
import { QueryExternalEmailMessagesDto } from './dto/query-external-email-messages.dto';

const GMAIL_MESSAGES_LIST_URL =
  'https://gmail.googleapis.com/gmail/v1/users/me/messages';

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const GMAIL_SYNC_MAX_RESULTS = 10;

const GMAIL_MANUAL_IMPORT_MAX_RESULTS = 25;

const GMAIL_METADATA_HEADERS = ['From', 'To', 'Cc', 'Bcc', 'Subject', 'Date'];

const GOOGLE_CALENDAR_EVENTS_BASE_URL =
  'https://www.googleapis.com/calendar/v3/calendars';

const GOOGLE_CALENDAR_PRIMARY_ID = 'primary';

const GOOGLE_CALENDAR_SYNC_MAX_RESULTS = 10;

const GOOGLE_CALENDAR_SYNC_DAYS_AHEAD = 30;

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

type GoogleCalendarEventsListResponse = {
  items?: GoogleCalendarEventResponse[];
  nextPageToken?: string;
  nextSyncToken?: string;
  summary?: string;
};

type GoogleCalendarEventResponse = {
  id?: string;
  iCalUID?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  created?: string;
  updated?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  organizer?: {
    email?: string;
    displayName?: string;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
    optional?: boolean;
  }>;
};

type ParsedCalendarDate = {
  value: Date | null;
  isAllDay: boolean;
};

const externalEmailMessageSelect = {
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
  dismissedAt: true,
  dismissedByUserId: true,
  dismissedReason: true,
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
} satisfies Prisma.ExternalEmailMessageSelect;

@Injectable()
export class ExternalSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly tokenEncryptionService: ConnectedAccountTokenEncryptionService,
    private readonly logger: SafeLoggerService,
  ) {}

  async syncGmailMessages(currentUser: CurrentUserType) {
    this.logger.info('external_sync.gmail.started', {
      event: 'external_sync.gmail.started',
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
    });

    const account = await this.getCurrentGoogleEmailAccount(currentUser);

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

      const staleDeleteResult =
        await this.markDeletedOrTrashedRecentGmailMessages({
          organizationId: currentUser.organizationId,
          connectedAccountId: account.id,
          accessToken,
          deletedAt: syncedAt,
        });


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

      this.logger.info('external_sync.gmail.completed', {
        event: 'external_sync.gmail.completed',
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        connectedAccountId: account.id,
        provider: account.provider,
        messagesFetched: messageRefs.length,
        messagesStored: storedCount,
        messagesDeletedAsStale: staleDeleteResult.count,
        bodyStored: false,
        aiAnalysisRun: false,
        crmRecordsCreated: false,
      });

      return {
        connectedAccountId: account.id,
        provider: account.provider,
        email: account.email,
        messagesFetched: messageRefs.length,
        messagesStored: storedCount,
        messagesDeletedAsStale: staleDeleteResult.count,
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

      this.logger.warn('external_sync.gmail.failed', {
        event: 'external_sync.gmail.failed',
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        connectedAccountId: account.id,
        provider: account.provider,
        errorMessage: message,
      });

      throw new BadRequestException(message);
    }
  }

  async syncGoogleCalendarEvents(currentUser: CurrentUserType) {
  this.logger.info('external_sync.calendar.started', {
    event: 'external_sync.calendar.started',
    organizationId: currentUser.organizationId,
    userId: currentUser.id,
  });

  const account = await this.prisma.connectedAccount.findFirst({
    where: {
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      provider: ConnectedAccountProvider.GOOGLE,
      status: ConnectedAccountStatus.CONNECTED,
      capabilities: {
        has: ConnectedAccountCapability.CALENDAR,
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
      'Current user does not have a connected Google calendar account',
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
      capability: ConnectedAccountCapability.CALENDAR,
    },
    data: {
      status: ConnectedAccountSyncStatus.INITIAL_SYNC_RUNNING,
      lastSyncAttemptAt: new Date(),
      lastError: null,
    },
  });

  const timeMin = new Date();
  const timeMax = this.addDays(timeMin, GOOGLE_CALENDAR_SYNC_DAYS_AHEAD);

  try {
    const accessToken = await this.getValidGoogleAccessToken(account);

    const listResponse = await this.fetchGoogleCalendarEventsList(accessToken, {
      calendarId: GOOGLE_CALENDAR_PRIMARY_ID,
      timeMin,
      timeMax,
    });

    const events = listResponse.items ?? [];
    const syncedAt = new Date();

    let storedCount = 0;

    const externalEventIds = events
      .filter((event) => Boolean(event.id))
      .map((event) => event.id as string);

    for (const event of events) {
      if (!event.id) {
        continue;
      }

      await this.upsertExternalCalendarEvent({
        organizationId: currentUser.organizationId,
        connectedAccountId: account.id,
        provider: account.provider,
        externalCalendarId: GOOGLE_CALENDAR_PRIMARY_ID,
        event,
        syncedAt,
      });

      storedCount += 1;
    }

    let staleDeletedCount = 0;

    if (!listResponse.nextPageToken) {
      const staleDeleteResult =
        await this.markMissingGoogleCalendarEventsAsDeleted({
          organizationId: currentUser.organizationId,
          connectedAccountId: account.id,
          externalCalendarId: GOOGLE_CALENDAR_PRIMARY_ID,
          externalEventIds,
          timeMin,
          timeMax,
          deletedAt: syncedAt,
        });

      staleDeletedCount = staleDeleteResult.count;
    }

    await this.prisma.connectedAccountSyncState.updateMany({
      where: {
        organizationId: currentUser.organizationId,
        connectedAccountId: account.id,
        capability: ConnectedAccountCapability.CALENDAR,
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

    this.logger.info('external_sync.calendar.completed', {
      event: 'external_sync.calendar.completed',
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      connectedAccountId: account.id,
      provider: account.provider,
      eventsFetched: events.length,
      eventsStored: storedCount,
      eventsDeletedAsStale: staleDeletedCount,
      bodyStored: false,
      aiAnalysisRun: false,
      crmRecordsCreated: false,
    });

    return {
      connectedAccountId: account.id,
      provider: account.provider,
      email: account.email,
      externalCalendarId: GOOGLE_CALENDAR_PRIMARY_ID,
      eventsFetched: events.length,
      eventsStored: storedCount,
      eventsDeletedAsStale: staleDeletedCount,
      nextPageToken: listResponse.nextPageToken ?? null,
      nextSyncToken: listResponse.nextSyncToken ?? null,
      timeMin,
      timeMax,
      syncedAt,
      bodyStored: false,
      aiAnalysisRun: false,
      crmRecordsCreated: false,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Google Calendar sync failed';

    await this.prisma.connectedAccountSyncState.updateMany({
      where: {
        organizationId: currentUser.organizationId,
        connectedAccountId: account.id,
        capability: ConnectedAccountCapability.CALENDAR,
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

    this.logger.warn('external_sync.calendar.failed', {
      event: 'external_sync.calendar.failed',
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      connectedAccountId: account.id,
      provider: account.provider,
      errorMessage: message,
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
    const view = query.view ?? 'active';

    const where: Prisma.ExternalEmailMessageWhereInput = {
      organizationId: currentUser.organizationId,
      deletedAt: null,
      dismissedAt: view === 'dismissed' ? { not: null } : null,
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
        select: externalEmailMessageSelect,
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

  async dismissEmailMessage(
    currentUser: CurrentUserType,
    id: string,
    dto: DismissExternalEmailMessageDto,
  ) {
    const existing = await this.prisma.externalEmailMessage.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        connectedAccountId: true,
        externalMessageId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('External email message not found');
    }

    const dismissedAt = new Date();
    const dismissedReason = dto.reason?.trim() || null;
    const emailMessage = await this.prisma.externalEmailMessage.update({
      where: { id: existing.id },
      data: {
        dismissedAt,
        dismissedByUserId: currentUser.id,
        dismissedReason,
      },
      select: externalEmailMessageSelect,
    });

    this.logger.info('external_email.dismissed', {
      event: 'external_email.dismissed',
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      externalEmailMessageId: existing.id,
      connectedAccountId: existing.connectedAccountId,
    });

    return emailMessage;
  }

  async restoreEmailMessage(currentUser: CurrentUserType, id: string) {
    const existing = await this.prisma.externalEmailMessage.findFirst({
      where: {
        id,
        organizationId: currentUser.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        connectedAccountId: true,
        externalMessageId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('External email message not found');
    }

    const emailMessage = await this.prisma.externalEmailMessage.update({
      where: { id: existing.id },
      data: {
        dismissedAt: null,
        dismissedByUserId: null,
        dismissedReason: null,
      },
      select: externalEmailMessageSelect,
    });

    this.logger.info('external_email.restored', {
      event: 'external_email.restored',
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      externalEmailMessageId: existing.id,
      connectedAccountId: existing.connectedAccountId,
    });

    return emailMessage;
  }

  async searchGmailMessagesPreview(
    currentUser: CurrentUserType,
    dto: GmailSearchPreviewDto,
  ) {
    const account = await this.getCurrentGoogleEmailAccount(currentUser);
    const accessToken = await this.getValidGoogleAccessToken(account);
    const maxResults = Math.min(
      dto.maxResults ?? 10,
      GMAIL_MANUAL_IMPORT_MAX_RESULTS,
    );
    const gmailQuery = this.buildManualGmailSearchQuery(dto);
    const listResponse = await this.fetchGmailMessagesList(accessToken, {
      q: gmailQuery,
      maxResults,
    });
    const providerMessageIds = (listResponse.messages ?? [])
      .map((message) => message.id)
      .filter((messageId): messageId is string => Boolean(messageId));

    const metadata = await Promise.all(
      providerMessageIds.map((messageId) =>
        this.fetchGmailMessageMetadata(accessToken, messageId),
      ),
    );

    const existingMessages =
      providerMessageIds.length > 0
        ? await this.prisma.externalEmailMessage.findMany({
            where: {
              organizationId: currentUser.organizationId,
              connectedAccountId: account.id,
              externalMessageId: {
                in: providerMessageIds,
              },
            },
            select: {
              externalMessageId: true,
              deletedAt: true,
              dismissedAt: true,
            },
          })
        : [];
    const existingByProviderId = new Map(
      existingMessages.map((message) => [message.externalMessageId, message]),
    );

    const messages = metadata
      .filter((message) => Boolean(message.id))
      .map((message) => {
        const headers = this.getGmailHeaders(message);
        const from = this.parseEmailAddress(headers.From);
        const existingMessage = existingByProviderId.get(message.id as string);
        const isDismissed = Boolean(existingMessage?.dismissedAt);
        const isActiveExisting = Boolean(
          existingMessage && !existingMessage.deletedAt && !isDismissed,
        );

        return {
          providerMessageId: message.id as string,
          threadId: message.threadId ?? null,
          subject: headers.Subject ?? null,
          senderEmail: from.email,
          senderName: from.name,
          snippet: message.snippet ?? null,
          internalDate: this.parseGmailInternalDate(message.internalDate),
          alreadyImported: isActiveExisting,
          dismissed: isDismissed,
        };
      });

    this.logger.info('external_sync.gmail_search_preview.completed', {
      event: 'external_sync.gmail_search_preview.completed',
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      connectedAccountId: account.id,
      messagesPreviewed: messages.length,
      bodyStored: false,
      aiAnalysisRun: false,
      crmRecordsCreated: false,
    });

    return {
      messages,
      meta: {
        maxResults,
        resultSizeEstimate: listResponse.resultSizeEstimate ?? null,
        bodyStored: false,
        aiAnalysisRun: false,
        crmRecordsCreated: false,
      },
    };
  }

  async importSelectedGmailMessages(
    currentUser: CurrentUserType,
    dto: ImportSelectedEmailMessagesDto,
  ) {
    const account = await this.getCurrentGoogleEmailAccount(currentUser);
    const accessToken = await this.getValidGoogleAccessToken(account);
    const providerMessageIds = Array.from(
      new Set(
        dto.providerMessageIds
          .map((messageId) => messageId.trim())
          .filter(Boolean),
      ),
    ).slice(0, GMAIL_MANUAL_IMPORT_MAX_RESULTS);
    const syncedAt = new Date();

    let imported = 0;
    let alreadyExisting = 0;
    let restored = 0;
    let skipped = 0;

    for (const providerMessageId of providerMessageIds) {
      const message = await this.fetchGmailMessageMetadataIfExists(
        accessToken,
        providerMessageId,
      );

      if (
        !message?.id ||
        message.labelIds?.includes('TRASH') ||
        message.labelIds?.includes('SPAM')
      ) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.externalEmailMessage.findUnique({
        where: {
          connectedAccountId_externalMessageId: {
            connectedAccountId: account.id,
            externalMessageId: message.id,
          },
        },
        select: {
          id: true,
          deletedAt: true,
          dismissedAt: true,
        },
      });

      await this.upsertExternalEmailMessage({
        organizationId: currentUser.organizationId,
        connectedAccountId: account.id,
        provider: account.provider,
        message,
        syncedAt,
        restoreDismissed: true,
        importedByUserId: currentUser.id,
      });

      if (!existing) {
        imported += 1;
      } else if (existing.deletedAt || existing.dismissedAt) {
        restored += 1;
      } else {
        alreadyExisting += 1;
      }
    }

    this.logger.info('external_sync.gmail_import_selected.completed', {
      event: 'external_sync.gmail_import_selected.completed',
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      connectedAccountId: account.id,
      requested: providerMessageIds.length,
      imported,
      alreadyExisting,
      restored,
      skipped,
      bodyStored: false,
      aiAnalysisRun: false,
      crmRecordsCreated: false,
    });

    return {
      connectedAccountId: account.id,
      provider: account.provider,
      email: account.email,
      requested: providerMessageIds.length,
      imported,
      alreadyExisting,
      restored,
      skipped,
      syncedAt,
      bodyStored: false,
      aiAnalysisRun: false,
      crmRecordsCreated: false,
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

private async fetchGmailMessageMetadataIfExists(
  accessToken: string,
  messageId: string,
): Promise<GmailMessageMetadataResponse | null> {
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

  if (response.status === 404) {
    return null;
  }

  const data = (await response.json()) as GmailMessageMetadataResponse;

  if (!response.ok) {
    throw new Error('Gmail message metadata endpoint returned an error');
  }

  return data;
}

private async markDeletedOrTrashedRecentGmailMessages(params: {
  organizationId: string;
  connectedAccountId: string;
  accessToken: string;
  deletedAt: Date;
}) {
  const recentLocalMessages = await this.prisma.externalEmailMessage.findMany({
    where: {
      organizationId: params.organizationId,
      connectedAccountId: params.connectedAccountId,
      deletedAt: null,
    },
    orderBy: [{ internalDate: 'desc' }, { createdAt: 'desc' }],
    take: 25,
    select: {
      id: true,
      externalMessageId: true,
    },
  });

  let count = 0;

  for (const localMessage of recentLocalMessages) {
    const gmailMessage = await this.fetchGmailMessageMetadataIfExists(
      params.accessToken,
      localMessage.externalMessageId,
    );

    const isMissing = !gmailMessage;
    const isTrashedOrSpam =
      gmailMessage?.labelIds?.includes('TRASH') ||
      gmailMessage?.labelIds?.includes('SPAM');

    if (!isMissing && !isTrashedOrSpam) {
      continue;
    }

    await this.prisma.externalEmailMessage.update({
      where: {
        id: localMessage.id,
      },
      data: {
        deletedAt: params.deletedAt,
        syncedAt: params.deletedAt,
      },
    });

    count += 1;
  }

  return { count };
}

  private async getCurrentGoogleEmailAccount(currentUser: CurrentUserType) {
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

    return {
      ...account,
      encryptedAccessToken: account.encryptedAccessToken,
      encryptedRefreshToken: account.encryptedRefreshToken,
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
      this.logger.warn('google.token_refresh.failed', {
        event: 'google.token_refresh.failed',
        statusCode: response.status,
        errorCode: data.error,
      });

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
    params: {
      q?: string;
      maxResults?: number;
    } = {},
  ): Promise<GmailMessagesListResponse> {
    const url = new URL(GMAIL_MESSAGES_LIST_URL);
    const maxResults = Math.min(
      Math.max(params.maxResults ?? GMAIL_SYNC_MAX_RESULTS, 1),
      GMAIL_MANUAL_IMPORT_MAX_RESULTS,
    );

    url.searchParams.set('maxResults', String(maxResults));
    url.searchParams.set('q', params.q ?? 'newer_than:30d -in:trash -in:spam');

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

  private buildManualGmailSearchQuery(dto: GmailSearchPreviewDto) {
    const parts = ['-in:trash', '-in:spam'];
    const searchText = dto.searchText?.trim();
    const sender = dto.sender?.trim();

    if (searchText) {
      parts.push(this.escapeGmailSearchTerm(searchText));
    }

    if (sender) {
      parts.push(`from:${this.escapeGmailSearchTerm(sender)}`);
    }

    if (dto.dateFrom) {
      parts.push(`after:${this.formatGmailSearchDate(dto.dateFrom)}`);
    }

    if (dto.dateTo) {
      parts.push(`before:${this.formatGmailSearchDate(dto.dateTo, 1)}`);
    }

    return parts.join(' ');
  }

  private escapeGmailSearchTerm(value: string) {
    const normalized = value.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();

    if (!normalized) {
      return '';
    }

    return /[\s:(){}]/.test(normalized) ? `"${normalized}"` : normalized;
  }

  private formatGmailSearchDate(value: string, addDays = 0) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid Gmail search date');
    }

    if (addDays > 0) {
      date.setUTCDate(date.getUTCDate() + addDays);
    }

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}/${month}/${day}`;
  }

  private async fetchGoogleCalendarEventsList(
  accessToken: string,
  params: {
    calendarId: string;
    timeMin: Date;
    timeMax: Date;
  },
): Promise<GoogleCalendarEventsListResponse> {
  const url = new URL(
    `${GOOGLE_CALENDAR_EVENTS_BASE_URL}/${encodeURIComponent(
      params.calendarId,
    )}/events`,
  );

  url.searchParams.set('maxResults', String(GOOGLE_CALENDAR_SYNC_MAX_RESULTS));
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('showDeleted', 'false');
  url.searchParams.set('timeMin', params.timeMin.toISOString());
  url.searchParams.set('timeMax', params.timeMax.toISOString());

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = (await response.json()) as GoogleCalendarEventsListResponse;

  if (!response.ok) {
    throw new Error('Google Calendar events list endpoint returned an error');
  }

  return data;
}

private async markMissingGoogleCalendarEventsAsDeleted(params: {
  organizationId: string;
  connectedAccountId: string;
  externalCalendarId: string;
  externalEventIds: string[];
  timeMin: Date;
  timeMax: Date;
  deletedAt: Date;
}) {
  return this.prisma.externalCalendarEvent.updateMany({
    where: {
      organizationId: params.organizationId,
      connectedAccountId: params.connectedAccountId,
      externalCalendarId: params.externalCalendarId,
      deletedAt: null,
      startAt: {
        gte: params.timeMin,
        lte: params.timeMax,
      },
      ...(params.externalEventIds.length > 0
        ? {
            externalEventId: {
              notIn: params.externalEventIds,
            },
          }
        : {}),
    },
    data: {
      deletedAt: params.deletedAt,
      syncedAt: params.deletedAt,
    },
  });
}

private async upsertExternalCalendarEvent(params: {
  organizationId: string;
  connectedAccountId: string;
  provider: ConnectedAccountProvider;
  externalCalendarId: string;
  event: GoogleCalendarEventResponse;
  syncedAt: Date;
}) {
  const start = this.parseGoogleCalendarDate(params.event.start);
  const end = this.parseGoogleCalendarDate(params.event.end);
  const attendees = this.mapGoogleCalendarAttendees(params.event.attendees);

  await this.prisma.externalCalendarEvent.upsert({
    where: {
      connectedAccountId_externalCalendarId_externalEventId: {
        connectedAccountId: params.connectedAccountId,
        externalCalendarId: params.externalCalendarId,
        externalEventId: params.event.id as string,
      },
    },
    create: {
      organizationId: params.organizationId,
      connectedAccountId: params.connectedAccountId,
      provider: params.provider,
      externalCalendarId: params.externalCalendarId,
      externalEventId: params.event.id as string,
      iCalUid: params.event.iCalUID ?? null,
      status: params.event.status ?? null,
      summary: params.event.summary ?? null,
      description: params.event.description ?? null,
      location: params.event.location ?? null,
      startAt: start.value,
      endAt: end.value,
      isAllDay: start.isAllDay,
      organizerEmail: params.event.organizer?.email?.toLowerCase() ?? null,
      organizerName: params.event.organizer?.displayName ?? null,
      attendeesJson:
        attendees.length > 0
          ? (attendees as Prisma.InputJsonValue)
          : Prisma.DbNull,
      htmlLink: params.event.htmlLink ?? null,
      metadataJson: {
        calendarId: params.externalCalendarId,
        created: params.event.created ?? null,
        updated: params.event.updated ?? null,
        startTimeZone: params.event.start?.timeZone ?? null,
        endTimeZone: params.event.end?.timeZone ?? null,
        hasDescription: Boolean(params.event.description),
        bodyStored: false,
      },
      syncedAt: params.syncedAt,
    },
    update: {
      iCalUid: params.event.iCalUID ?? null,
      status: params.event.status ?? null,
      summary: params.event.summary ?? null,
      description: params.event.description ?? null,
      location: params.event.location ?? null,
      startAt: start.value,
      endAt: end.value,
      isAllDay: start.isAllDay,
      organizerEmail: params.event.organizer?.email?.toLowerCase() ?? null,
      organizerName: params.event.organizer?.displayName ?? null,
      attendeesJson:
        attendees.length > 0
          ? (attendees as Prisma.InputJsonValue)
          : Prisma.DbNull,
      htmlLink: params.event.htmlLink ?? null,
      metadataJson: {
        calendarId: params.externalCalendarId,
        created: params.event.created ?? null,
        updated: params.event.updated ?? null,
        startTimeZone: params.event.start?.timeZone ?? null,
        endTimeZone: params.event.end?.timeZone ?? null,
        hasDescription: Boolean(params.event.description),
        bodyStored: false,
      },
      syncedAt: params.syncedAt,
      deletedAt: null,
    },
  });
}

private parseGoogleCalendarDate(
  value?: GoogleCalendarEventResponse['start'],
): ParsedCalendarDate {
  if (!value) {
    return {
      value: null,
      isAllDay: false,
    };
  }

  if (value.dateTime) {
    return {
      value: new Date(value.dateTime),
      isAllDay: false,
    };
  }

  if (value.date) {
    return {
      value: new Date(`${value.date}T00:00:00.000Z`),
      isAllDay: true,
    };
  }

  return {
    value: null,
    isAllDay: false,
  };
}

private mapGoogleCalendarAttendees(
  attendees?: GoogleCalendarEventResponse['attendees'],
) {
  return (attendees ?? [])
    .map((attendee) => ({
      email: attendee.email?.toLowerCase() ?? null,
      displayName: attendee.displayName ?? null,
      responseStatus: attendee.responseStatus ?? null,
      optional: attendee.optional ?? false,
    }))
    .filter((attendee) => Boolean(attendee.email || attendee.displayName));
}

private addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

  private async upsertExternalEmailMessage(params: {
    organizationId: string;
    connectedAccountId: string;
    provider: ConnectedAccountProvider;
    message: GmailMessageMetadataResponse;
    syncedAt: Date;
    restoreDismissed?: boolean;
    importedByUserId?: string;
  }) {
    const headers = this.getGmailHeaders(params.message);
    const from = this.parseEmailAddress(headers.From);
    const to = this.parseEmailAddressList(headers.To);
    const cc = this.parseEmailAddressList(headers.Cc);
    const bcc = this.parseEmailAddressList(headers.Bcc);
    const internalDate = this.parseGmailInternalDate(
      params.message.internalDate,
    );
    const metadataJson = {
      gmailHistoryId: params.message.historyId ?? null,
      sizeEstimate: params.message.sizeEstimate ?? null,
      headersStored: GMAIL_METADATA_HEADERS,
      bodyStored: false,
      ...(params.importedByUserId
        ? {
            manualImport: {
              importedAt: params.syncedAt.toISOString(),
              importedByUserId: params.importedByUserId,
            },
          }
        : {}),
    };

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
        metadataJson,
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
        metadataJson,
        syncedAt: params.syncedAt,
        deletedAt: null,
        ...(params.restoreDismissed
          ? {
              dismissedAt: null,
              dismissedByUserId: null,
              dismissedReason: null,
            }
          : {}),
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
