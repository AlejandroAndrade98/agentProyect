// FILE: apps/api/src/config/configuration.ts

import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: Number(process.env.PORT || process.env.API_PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL,
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '1mb',
  logLevel: process.env.LOG_LEVEL || 'info',
  logFormat: process.env.LOG_FORMAT || 'json',
  requestLoggingEnabled: process.env.REQUEST_LOGGING_ENABLED || 'true',
  logRedactSensitive: process.env.LOG_REDACT_SENSITIVE || 'true',
  databaseUrl: process.env.DATABASE_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  authRecoveryDevMode: process.env.AUTH_RECOVERY_DEV_MODE || 'false',
  passwordResetTokenTtlMinutes: Number(
    process.env.AUTH_PASSWORD_RESET_TOKEN_TTL_MINUTES || 30,
  ),
  passwordResetPublicUrl: process.env.PASSWORD_RESET_PUBLIC_URL,

  emailProvider: process.env.EMAIL_PROVIDER || 'none',
  emailDeliveryEnabled: process.env.EMAIL_DELIVERY_ENABLED || 'false',
  emailFrom: process.env.EMAIL_FROM,
  emailReplyTo: process.env.EMAIL_REPLY_TO,
  emailAppName: process.env.EMAIL_APP_NAME || 'Sales AI Platform',
  emailPublicAppUrl: process.env.EMAIL_PUBLIC_APP_URL,
  resendApiKey: process.env.RESEND_API_KEY,

  googleOAuthClientId:
    process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
  googleOAuthClientSecret:
    process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
  googleOAuthRedirectUri:
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    process.env.GOOGLE_REDIRECT_URI ||
    'http://localhost:4000/api/connected-accounts/oauth/google/callback',

  connectedAccountTokenEncryptionKey:
    process.env.CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY,
  connectedAccountTokenEncryptionVersion:
    process.env.CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY_VERSION ||
    process.env.CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_VERSION ||
    'v1',

  aiProvider: process.env.AI_PROVIDER || 'mock',
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL || 'gpt-5.5',
  aiMaxInputChars: Number(process.env.AI_MAX_INPUT_CHARS || 10000),
}));
