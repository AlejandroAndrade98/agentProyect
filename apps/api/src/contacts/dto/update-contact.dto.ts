import { ImportanceLevel, Source } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class UpdateContactDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  firstName?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  lastName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsOptional()
  jobTitle?: string;

  @IsUrl()
  @IsOptional()
  linkedinUrl?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  expertise?: string;

  @IsEnum(ImportanceLevel)
  @IsOptional()
  importanceLevel?: ImportanceLevel;

  @IsEnum(Source)
  @IsOptional()
  source?: Source;
}