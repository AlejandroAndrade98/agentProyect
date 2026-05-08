import { Controller, Get } from '@nestjs/common';
import { HealthCheckService } from '@nestjs/terminus';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async check() {
    // Basic check for API and Database connectivity
    return this.health.check([
      () => this.prisma.$queryRaw`SELECT 1`,
    ]);
  }
}
