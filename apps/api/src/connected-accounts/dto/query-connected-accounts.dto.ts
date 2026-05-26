import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  ConnectedAccountCapability,
  ConnectedAccountProvider,
  ConnectedAccountStatus,
} from '@prisma/client';

export class QueryConnectedAccountsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  @IsOptional()
  @IsEnum(ConnectedAccountProvider)
  provider?: ConnectedAccountProvider;

  @IsOptional()
  @IsEnum(ConnectedAccountStatus)
  status?: ConnectedAccountStatus;

  @IsOptional()
  @IsEnum(ConnectedAccountCapability)
  capability?: ConnectedAccountCapability;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}