import { ImportanceLevel, Source } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryContactsDto extends PaginationQueryDto {
  @IsIn([
    'firstName',
    'lastName',
    'email',
    'jobTitle',
    'city',
    'country',
    'importanceLevel',
    'source',
    'createdAt',
    'updatedAt',
  ])
  @IsOptional()
  sortBy?:
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'jobTitle'
    | 'city'
    | 'country'
    | 'importanceLevel'
    | 'source'
    | 'createdAt'
    | 'updatedAt' = 'createdAt';

  @IsString()
  @IsOptional()
  companyId?: string;

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
}