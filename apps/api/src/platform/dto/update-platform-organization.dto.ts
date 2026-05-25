import { OrganizationAccountType, OrganizationStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdatePlatformOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsEnum(OrganizationAccountType)
  accountType?: OrganizationAccountType;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  statusReason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000)
  maxActiveLeads?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  aiMonthlyCreditsLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  aiDefaultUserMonthlyCreditsLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  aiCreditsBalance?: number;
}