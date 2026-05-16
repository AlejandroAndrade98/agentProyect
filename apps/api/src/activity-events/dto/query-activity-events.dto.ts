import { ActivityEventType, EntityType, Source } from '@prisma/client';
import { IsEnum, IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryActivityEventsDto extends PaginationQueryDto {
  @IsEnum(ActivityEventType)
  @IsOptional()
  type?: ActivityEventType;

  @IsEnum(EntityType)
  @IsOptional()
  entityType?: EntityType;

  @IsString()
  @IsOptional()
  entityId?: string;

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

  @IsString()
  @IsOptional()
  taskId?: string;

  @IsString()
  @IsOptional()
  noteId?: string;

  @IsString()
  @IsOptional()
  actorUserId?: string;

  @IsISO8601()
  @IsOptional()
  from?: string;

  @IsISO8601()
  @IsOptional()
  to?: string;

  @IsIn(['occurredAt', 'createdAt'])
  @IsOptional()
  sortBy?: 'occurredAt' | 'createdAt';
}