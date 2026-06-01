import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { CurrentUser as CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser } from '../auth/interfaces/current-user.interface';
import { RateLimit } from '../common/security/rate-limit.decorator';
import { RateLimitGuard } from '../common/security/rate-limit.guard';
import { ConnectedAccountsService } from './connected-accounts.service';
import { CreateDevConnectedAccountDto } from './dto/create-dev-connected-account.dto';
import { QueryConnectedAccountsDto } from './dto/query-connected-accounts.dto';

import { StartGoogleOAuthDto } from './dto/start-google-oauth.dto';

const CONNECTED_ACCOUNTS_READ_ROLES = [
  Role.SUPER_ADMIN,
  Role.OWNER,
  Role.ADMIN,
  Role.SALES,
  Role.VIEWER,
];

const CONNECTED_ACCOUNTS_CONNECT_ROLES = [
  Role.SUPER_ADMIN,
  Role.OWNER,
  Role.ADMIN,
  Role.SALES,
];

const CONNECTED_ACCOUNTS_DISCONNECT_REQUEST_ROLES = [
  Role.SUPER_ADMIN,
  Role.OWNER,
  Role.ADMIN,
  Role.SALES,
  Role.VIEWER,
];

const CONNECTED_ACCOUNTS_MANAGE_ROLES = [
  Role.SUPER_ADMIN,
  Role.OWNER,
  Role.ADMIN,
];

@Controller('connected-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConnectedAccountsController {
  constructor(
    private readonly connectedAccountsService: ConnectedAccountsService,
  ) {}

  @Get()
  @Roles(...CONNECTED_ACCOUNTS_READ_ROLES)
  findAll(
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Query() query: QueryConnectedAccountsDto,
  ) {
    return this.connectedAccountsService.findAll(currentUser, query);
  }

  @Get('oauth/google/start')
  @Roles(...CONNECTED_ACCOUNTS_CONNECT_ROLES)
  @RateLimit({
    name: 'connectedAccounts.googleOAuthStart',
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyBy: 'userOrIp',
  })
  @UseGuards(RateLimitGuard)
  startGoogleOAuth(
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Query() query: StartGoogleOAuthDto,
  ) {
    return this.connectedAccountsService.startGoogleOAuth(currentUser, query);
  }

  @Get(':id')
  @Roles(...CONNECTED_ACCOUNTS_READ_ROLES)
  findOne(
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.connectedAccountsService.findOne(currentUser, id);
  }

  @Post('dev-connect')
  @Roles(...CONNECTED_ACCOUNTS_CONNECT_ROLES)
  @RateLimit({
    name: 'connectedAccounts.devConnect',
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyBy: 'userOrIp',
  })
  @UseGuards(RateLimitGuard)
  devConnect(
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Body() dto: CreateDevConnectedAccountDto,
  ) {
    return this.connectedAccountsService.devConnect(currentUser, dto);
  }

  @Patch(':id/disconnect-request')
  @Roles(...CONNECTED_ACCOUNTS_DISCONNECT_REQUEST_ROLES)
  requestDisconnect(
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.connectedAccountsService.requestDisconnect(currentUser, id);
  }

  @Patch(':id/disconnect')
  @Roles(...CONNECTED_ACCOUNTS_MANAGE_ROLES)
  disconnect(
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.connectedAccountsService.disconnect(currentUser, id);
  }
}
