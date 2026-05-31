import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';

import { AppModule } from './app.module';
import { requestIdMiddleware } from './common/security/request-id.middleware';
import { SafeExceptionFilter } from './common/security/safe-exception.filter';
import { createSecurityHeadersMiddleware } from './common/security/security-headers.middleware';
import { validateProductionConfiguration } from './config/production-config.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);
  validateProductionConfiguration(configService);

  const corsOrigin =
    configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000';
  const requestBodyLimit =
    configService.get<string>('app.requestBodyLimit') ?? '1mb';

  app.use(requestIdMiddleware);
  app.use(
    createSecurityHeadersMiddleware({
      isProduction: process.env.NODE_ENV === 'production',
    }),
  );
  app.use(json({ limit: requestBodyLimit }));
  app.use(urlencoded({ extended: true, limit: requestBodyLimit }));

  app.enableCors({
    origin: corsOrigin.split(',').map((origin) => origin.trim()),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-App-Locale',
      'X-Request-Id',
    ],
    exposedHeaders: [
      'X-Request-Id',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new SafeExceptionFilter());

  const configuredPort = Number(configService.get<string | number>('app.port'));
  const port =
    Number.isInteger(configuredPort) && configuredPort > 0
      ? configuredPort
      : 4000;

  await app.listen(port);
  console.log(`API listening on port ${port}`);
}

bootstrap();
