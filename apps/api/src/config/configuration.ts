// FILE: apps/api/src/config/configuration.ts

import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: Number(process.env.API_PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '1mb',
  databaseUrl: process.env.DATABASE_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,

  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
  googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  googleOAuthRedirectUri:
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
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
