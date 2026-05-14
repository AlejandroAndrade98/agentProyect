import { ImportanceLevel, Source } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryNotesDto extends PaginationQueryDto {
  @IsIn([
    'title',
    'importanceLevel',
    'source',
    'createdAt',
    'updatedAt',
  ])
  @IsOptional()
  sortBy?:
    | 'title'
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
  companyId?: string;

  @IsString()
  @IsOptional()
  contactId?: string;

  @IsString()
  @IsOptional()
  leadId?: string;
}