import { ImportanceLevel, Source } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryCompaniesDto extends PaginationQueryDto {
  @IsIn([
    'name',
    'industry',
    'city',
    'country',
    'importanceLevel',
    'source',
    'createdAt',
    'updatedAt',
  ])
  @IsOptional()
  sortBy?:
    | 'name'
    | 'industry'
    | 'city'
    | 'country'
    | 'importanceLevel'
    | 'source'
    | 'createdAt'
    | 'updatedAt' = 'createdAt';

  @IsEnum(ImportanceLevel)
  @IsOptional()
  importanceLevel?: ImportanceLevel;

  @IsEnum(Source)
  @IsOptional()
  source?: Source;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  industry?: string;
}