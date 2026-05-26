import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { ConnectedAccountsService } from './connected-accounts.service';
import { GoogleOAuthCallbackDto } from './dto/google-oauth-callback.dto';

@Controller('connected-accounts/oauth/google')
export class ConnectedAccountsOAuthPublicController {
  constructor(
    private readonly connectedAccountsService: ConnectedAccountsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('callback')
  async handleGoogleOAuthCallback(
    @Query() query: GoogleOAuthCallbackDto,
    @Res() response: Response,
  ) {
    await this.connectedAccountsService.handleGoogleOAuthCallback(query);

    const corsOrigin =
      this.configService.get<string>('app.corsOrigin') ||
      'http://localhost:3000';

    const frontendBaseUrl = corsOrigin.split(',')[0].trim().replace(/\/$/, '');

    return response.redirect(
      `${frontendBaseUrl}/dashboard/settings/connected-accounts?connected=google`,
    );
  }
}