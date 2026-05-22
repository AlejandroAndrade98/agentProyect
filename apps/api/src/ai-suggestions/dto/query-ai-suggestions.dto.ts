import { AiSuggestionStatus, AiSuggestionType, EntityType } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryAiSuggestionsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AiSuggestionStatus)
  status?: AiSuggestionStatus;

  @IsOptional()
  @IsEnum(AiSuggestionType)
  type?: AiSuggestionType;

  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsString()
  noteId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'reviewedAt', 'expiresAt'])
  sortBy?: 'createdAt' | 'updatedAt' | 'reviewedAt' | 'expiresAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}