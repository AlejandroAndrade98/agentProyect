import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SafeLoggerService } from '../common/observability/safe-logger.service';
import type {
  EmailDeliveryResult,
  EmailProvider,
  SendOrganizationInvitationEmailParams,
  SendPasswordResetEmailParams,
} from './email.types';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

type EmailConfig = {
  deliveryEnabled: boolean;
  provider: EmailProvider;
  from?: string;
  replyTo?: string;
  appName: string;
  resendApiKey?: string;
};

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  eventBase: 'email.invitation.send' | 'email.password_reset.send';
};

@Injectable()
export class EmailService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: SafeLoggerService,
  ) {}

  async sendOrganizationInvitationEmail(
    params: SendOrganizationInvitationEmailParams,
  ): Promise<EmailDeliveryResult> {
    const config = this.getEmailConfig();
    const subject = `You're invited to ${config.appName}`;
    const escapedAppName = escapeHtml(config.appName);
    const escapedOrganizationName = escapeHtml(params.organizationName);
    const escapedRole = escapeHtml(params.role);
    const escapedInvitationUrl = escapeHtml(params.invitationUrl);
    const expiresAt = params.expiresAt.toISOString();

    return this.sendEmail({
      to: params.to,
      subject,
      eventBase: 'email.invitation.send',
      text: [
        `You're invited to ${config.appName}.`,
        '',
        `Organization: ${params.organizationName}`,
        `Role: ${params.role}`,
        `Expires: ${expiresAt}`,
        '',
        `Accept your invitation: ${params.invitationUrl}`,
        '',
        'If you were not expecting this invitation, you can ignore this email.',
      ].join('\n'),
      html: [
        `<p>You're invited to <strong>${escapedAppName}</strong>.</p>`,
        `<p><strong>Organization:</strong> ${escapedOrganizationName}<br />`,
        `<strong>Role:</strong> ${escapedRole}<br />`,
        `<strong>Expires:</strong> ${escapeHtml(expiresAt)}</p>`,
        `<p><a href="${escapedInvitationUrl}">Accept your invitation</a></p>`,
        '<p>If you were not expecting this invitation, you can ignore this email.</p>',
      ].join(''),
    });
  }

  async sendPasswordResetEmail(
    params: SendPasswordResetEmailParams,
  ): Promise<EmailDeliveryResult> {
    const config = this.getEmailConfig();
    const subject = `Reset your ${config.appName} password`;
    const escapedAppName = escapeHtml(config.appName);
    const escapedResetUrl = escapeHtml(params.resetUrl);
    const greeting = params.userName?.trim()
      ? `Hi ${params.userName.trim()},`
      : 'Hi,';

    return this.sendEmail({
      to: params.to,
      subject,
      eventBase: 'email.password_reset.send',
      text: [
        greeting,
        '',
        `Use this link to reset your ${config.appName} password:`,
        params.resetUrl,
        '',
        `This link expires in ${params.expiresInMinutes} minutes.`,
        'If you did not request a password reset, you can ignore this email.',
      ].join('\n'),
      html: [
        `<p>${escapeHtml(greeting)}</p>`,
        `<p>Use this link to reset your <strong>${escapedAppName}</strong> password.</p>`,
        `<p><a href="${escapedResetUrl}">Reset your password</a></p>`,
        `<p>This link expires in ${params.expiresInMinutes} minutes.</p>`,
        '<p>If you did not request a password reset, you can ignore this email.</p>',
      ].join(''),
    });
  }

  getPublicAppUrl() {
    return (
      this.configService.get<string>('app.emailPublicAppUrl') ||
      this.configService.get<string>('app.frontendUrl') ||
      'http://localhost:3000'
    );
  }

  buildOrganizationInvitationUrl(token: string) {
    const url = new URL(`/accept-invitation/${token}`, this.getPublicAppUrl());
    return url.toString();
  }

  private async sendEmail(input: SendEmailInput): Promise<EmailDeliveryResult> {
    const config = this.getEmailConfig();

    if (!config.deliveryEnabled) {
      return {
        status: 'skipped',
        provider: config.provider,
        reason: 'disabled',
      };
    }

    if (config.provider === 'none') {
      return {
        status: 'skipped',
        provider: config.provider,
        reason: 'provider_none',
      };
    }

    if (!config.from || !config.resendApiKey) {
      this.logFailure(input, config.provider, 'missing_config');
      return {
        status: 'failed',
        provider: config.provider,
        reason: 'missing_config',
      };
    }

    return this.sendViaResend(input, config);
  }

  private async sendViaResend(
    input: SendEmailInput,
    config: EmailConfig,
  ): Promise<EmailDeliveryResult> {
    try {
      const response = await fetch(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          ...(config.replyTo ? { reply_to: config.replyTo } : {}),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        id?: string;
      } | null;

      if (!response.ok) {
        this.logFailure(input, config.provider, 'provider_error', response.status);
        return {
          status: 'failed',
          provider: config.provider,
          reason: 'provider_error',
        };
      }

      this.logger.info(`${input.eventBase}.success`, {
        event: `${input.eventBase}.success`,
        provider: config.provider,
        emailHash: this.logger.hashIdentifier(input.to),
        messageId: payload?.id,
      });

      return {
        status: 'sent',
        provider: config.provider,
        messageId: payload?.id,
      };
    } catch (error) {
      this.logFailure(input, config.provider, 'provider_error', undefined, error);
      return {
        status: 'failed',
        provider: config.provider,
        reason: 'provider_error',
      };
    }
  }

  private logFailure(
    input: SendEmailInput,
    provider: EmailProvider,
    reason: EmailDeliveryResult['reason'],
    providerStatus?: number,
    error?: unknown,
  ) {
    this.logger.warn(`${input.eventBase}.failure`, {
      event: `${input.eventBase}.failure`,
      provider,
      reason,
      providerStatus,
      emailHash: this.logger.hashIdentifier(input.to),
      ...(error ? this.logger.toErrorFields(error) : {}),
    });
  }

  private getEmailConfig(): EmailConfig {
    const provider = normalizeEmailProvider(
      this.configService.get<string>('app.emailProvider'),
    );

    return {
      deliveryEnabled: parseBoolean(
        this.configService.get<string>('app.emailDeliveryEnabled'),
      ),
      provider,
      from: normalizeOptionalString(
        this.configService.get<string>('app.emailFrom'),
      ),
      replyTo: normalizeOptionalString(
        this.configService.get<string>('app.emailReplyTo'),
      ),
      appName:
        normalizeOptionalString(
          this.configService.get<string>('app.emailAppName'),
        ) ?? 'Sales AI Platform',
      resendApiKey: normalizeOptionalString(
        this.configService.get<string>('app.resendApiKey'),
      ),
    };
  }
}

function normalizeEmailProvider(value: string | undefined): EmailProvider {
  const provider = value?.trim().toLowerCase();

  return provider === 'resend' ? 'resend' : 'none';
}

function parseBoolean(value: string | undefined) {
  return value?.trim().toLowerCase() === 'true';
}

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
