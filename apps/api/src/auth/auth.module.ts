import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    JwtModule.register({}), // Configured dynamically in AuthService
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
