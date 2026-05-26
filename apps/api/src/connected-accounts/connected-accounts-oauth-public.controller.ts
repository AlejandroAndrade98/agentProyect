import { Controller, Get, Query } from '@nestjs/common';

import { ConnectedAccountsService } from './connected-accounts.service';
import { GoogleOAuthCallbackDto } from './dto/google-oauth-callback.dto';

@Controller('connected-accounts/oauth/google')
export class ConnectedAccountsOAuthPublicController {
  constructor(
    private readonly connectedAccountsService: ConnectedAccountsService,
  ) {}

  @Get('callback')
  handleGoogleOAuthCallback(@Query() query: GoogleOAuthCallbackDto) {
    return this.connectedAccountsService.handleGoogleOAuthCallback(query);
  }
}