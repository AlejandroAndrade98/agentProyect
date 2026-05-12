import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { ImportanceLevel, Source } from '@prisma/client';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(ImportanceLevel)
  importanceLevel?: ImportanceLevel;

  @IsOptional()
  @IsEnum(Source)
  source?: Source;
}