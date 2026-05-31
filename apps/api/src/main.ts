import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const corsOrigin =
    configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000';

  app.enableCors({
    origin: corsOrigin.split(',').map((origin) => origin.trim()),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Locale'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configuredPort = Number(configService.get<string | number>('app.port'));
  const port =
    Number.isInteger(configuredPort) && configuredPort > 0
      ? configuredPort
      : 4000;

  await app.listen(port);
  console.log(`API listening on port ${port}`);
}

bootstrap();
