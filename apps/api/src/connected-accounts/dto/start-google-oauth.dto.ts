import { Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional } from 'class-validator';
import { ConnectedAccountCapability } from '@prisma/client';

function normalizeCapabilitiesQuery(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value;
}

export class StartGoogleOAuthDto {
  @IsOptional()
  @Transform(({ value }) => normalizeCapabilitiesQuery(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ConnectedAccountCapability, { each: true })
  capabilities?: ConnectedAccountCapability[];
}