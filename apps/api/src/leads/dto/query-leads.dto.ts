import { ImportanceLevel, LeadStatus, Priority, Source } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryLeadsDto extends PaginationQueryDto {
  @IsIn([
    'title',
    'status',
    'priority',
    'importanceLevel',
    'source',
    'estimatedBudget',
    'expectedCloseDate',
    'lastContactAt',
    'createdAt',
    'updatedAt',
  ])
  @IsOptional()
  sortBy?:
    | 'title'
    | 'status'
    | 'priority'
    | 'importanceLevel'
    | 'source'
    | 'estimatedBudget'
    | 'expectedCloseDate'
    | 'lastContactAt'
    | 'createdAt'
    | 'updatedAt' = 'createdAt';

  @IsEnum(LeadStatus)
  @IsOptional()
  status?: LeadStatus;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

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
  assignedToUserId?: string;
}