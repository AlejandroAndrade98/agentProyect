import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RateLimit } from '../common/security/rate-limit.decorator';
import { RateLimitGuard } from '../common/security/rate-limit.guard';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponse } from './interfaces/auth-response.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    name: 'auth.login',
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyBy: 'ipAndBodyEmail',
  })
  @UseGuards(RateLimitGuard)
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    name: 'auth.forgot_password',
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyBy: 'ipAndBodyEmail',
  })
  @UseGuards(RateLimitGuard)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: Request,
  ): Promise<{ message: string; devResetUrl?: string }> {
    return this.authService.forgotPassword(dto, {
      ip: request.ip || request.socket.remoteAddress,
      userAgent: getHeaderString(request.headers['user-agent']),
    });
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    name: 'auth.reset_password',
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyBy: 'ipAndBodyToken',
  })
  @UseGuards(RateLimitGuard)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(dto, {
      ip: request.ip || request.socket.remoteAddress,
      userAgent: getHeaderString(request.headers['user-agent']),
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    name: 'auth.refresh',
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyBy: 'ip',
  })
  @UseGuards(RateLimitGuard)
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponse> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshTokenDto): Promise<{ message: string }> {
    return this.authService.logout(dto);
  }
}

function getHeaderString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.join(',');
  }

  return value;
}
