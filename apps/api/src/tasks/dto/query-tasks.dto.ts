import { ImportanceLevel, Priority, TaskStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryTasksDto extends PaginationQueryDto {
  @IsIn([
    'title',
    'status',
    'priority',
    'importanceLevel',
    'dueDate',
    'completedAt',
    'createdAt',
    'updatedAt',
  ])
  @IsOptional()
  sortBy?:
    | 'title'
    | 'status'
    | 'priority'
    | 'importanceLevel'
    | 'dueDate'
    | 'completedAt'
    | 'createdAt'
    | 'updatedAt' = 'createdAt';

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsEnum(ImportanceLevel)
  @IsOptional()
  importanceLevel?: ImportanceLevel;

  @IsString()
  @IsOptional()
  leadId?: string;

  @IsString()
  @IsOptional()
  contactId?: string;

  @IsString()
  @IsOptional()
  assignedToUserId?: string;
}