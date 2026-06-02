import { ConfigService } from '@nestjs/config';

const GOOGLE_OAUTH_CALLBACK_PATH =
  '/api/connected-accounts/oauth/google/callback';

export function validateProductionConfiguration(configService: ConfigService) {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const requiredKeys = [
    'app.googleOAuthClientId',
    'app.googleOAuthClientSecret',
    'app.googleOAuthRedirectUri',
    'app.frontendUrl',
    'app.connectedAccountTokenEncryptionKey',
    'app.connectedAccountTokenEncryptionVersion',
  ];

  const missingKeys = requiredKeys.filter((key) => !configService.get(key));

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing production configuration values: ${missingKeys.join(', ')}`,
    );
  }

  validateAbsoluteUrl(
    configService.get<string>('app.googleOAuthRedirectUri'),
    'app.googleOAuthRedirectUri',
  );
  validateAbsoluteUrl(
    configService.get<string>('app.frontendUrl'),
    'app.frontendUrl',
  );

  const passwordResetPublicUrl = configService.get<string>(
    'app.passwordResetPublicUrl',
  );
  if (passwordResetPublicUrl) {
    validateAbsoluteUrl(passwordResetPublicUrl, 'app.passwordResetPublicUrl');
  }

  const emailPublicAppUrl = configService.get<string>('app.emailPublicAppUrl');
  if (emailPublicAppUrl) {
    validateAbsoluteUrl(emailPublicAppUrl, 'app.emailPublicAppUrl');
  }

  validateEmailDeliveryConfiguration(configService);

  const redirectUri = new URL(
    configService.get<string>('app.googleOAuthRedirectUri') as string,
  );

  if (redirectUri.pathname !== GOOGLE_OAUTH_CALLBACK_PATH) {
    throw new Error(
      `app.googleOAuthRedirectUri must use ${GOOGLE_OAUTH_CALLBACK_PATH}`,
    );
  }

  const corsOrigin = configService.get<string>('app.corsOrigin') ?? '';

  if (!corsOrigin || corsOrigin.split(',').some((origin) => origin.trim() === '*')) {
    throw new Error('app.corsOrigin must use exact production origins');
  }

  validateConnectedAccountTokenEncryptionKey(
    configService.get<string>('app.connectedAccountTokenEncryptionKey'),
  );

  if (
    (
      configService.get<string>('app.authRecoveryDevMode') ?? 'false'
    ).toLowerCase() === 'true'
  ) {
    throw new Error('app.authRecoveryDevMode must be disabled in production');
  }
}

function validateAbsoluteUrl(value: string | undefined, key: string) {
  if (!value) {
    throw new Error(`${key} is required`);
  }

  try {
    const url = new URL(value);

    if (!['https:', 'http:'].includes(url.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error(`${key} must be an absolute URL`);
  }
}

function validateConnectedAccountTokenEncryptionKey(value: string | undefined) {
  if (!value) {
    throw new Error('app.connectedAccountTokenEncryptionKey is required');
  }

  if (Buffer.from(value, 'base64').length !== 32) {
    throw new Error(
      'app.connectedAccountTokenEncryptionKey must decode to exactly 32 bytes',
    );
  }
}

function validateEmailDeliveryConfiguration(configService: ConfigService) {
  const provider = (
    configService.get<string>('app.emailProvider') ?? 'none'
  ).toLowerCase();
  const deliveryEnabled =
    (
      configService.get<string>('app.emailDeliveryEnabled') ?? 'false'
    ).toLowerCase() === 'true';

  if (!['none', 'resend'].includes(provider)) {
    throw new Error('app.emailProvider must be one of: none, resend');
  }

  if (deliveryEnabled && provider === 'none') {
    throw new Error(
      'app.emailProvider must be configured when email delivery is enabled',
    );
  }

  if (provider === 'resend') {
    const resendConfig: Array<[string, string | undefined]> = [
      ['app.resendApiKey', configService.get<string>('app.resendApiKey')],
      ['app.emailFrom', configService.get<string>('app.emailFrom')],
    ];
    const missingKeys = resendConfig
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingKeys.length > 0) {
      throw new Error(
        `Missing Resend email configuration values: ${missingKeys.join(', ')}`,
      );
    }
  }
}
