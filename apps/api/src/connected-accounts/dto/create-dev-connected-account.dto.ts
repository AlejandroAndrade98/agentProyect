import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  ConnectedAccountCapability,
  ConnectedAccountProvider,
} from '@prisma/client';

export class CreateDevConnectedAccountDto {
  @IsEnum(ConnectedAccountProvider)
  provider!: ConnectedAccountProvider;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  externalAccountId?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ConnectedAccountCapability, { each: true })
  capabilities?: ConnectedAccountCapability[];
}