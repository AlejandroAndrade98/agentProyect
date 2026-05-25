import { OrganizationAccountType, OrganizationStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class OnboardPlatformOrganizationDto {
  @IsString()
  @IsNotEmpty()
  organizationName!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsEmail()
  ownerEmail!: string;

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
  @IsIn(['TRIAL', 'ACTIVE'])
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
  @IsDateString()
  trialEndsAt?: string;

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
  @IsBoolean()
  aiEnabled?: boolean;

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