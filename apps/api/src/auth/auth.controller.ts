import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { RateLimit } from '../common/security/rate-limit.decorator';
import { RateLimitGuard } from '../common/security/rate-limit.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
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
