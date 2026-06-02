export type EmailProvider = 'none' | 'resend';

export type EmailDeliveryStatus = 'sent' | 'skipped' | 'failed';

export type EmailDeliveryResult = {
  status: EmailDeliveryStatus;
  provider: EmailProvider;
  messageId?: string;
  reason?: 'disabled' | 'provider_none' | 'missing_config' | 'provider_error';
};

export type SendOrganizationInvitationEmailParams = {
  to: string;
  organizationName: string;
  invitationUrl: string;
  role: string;
  expiresAt: Date;
};

export type SendPasswordResetEmailParams = {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
  userName?: string | null;
};
