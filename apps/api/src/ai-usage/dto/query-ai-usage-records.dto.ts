import { AiUsageFeature, AiUsageStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryAiUsageRecordsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AiUsageFeature)
  feature?: AiUsageFeature;

  @IsOptional()
  @IsEnum(AiUsageStatus)
  status?: AiUsageStatus;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  aiSuggestionId?: string;

  @IsOptional()
  @IsIn([
    'createdAt',
    'creditsUsed',
    'tokensInput',
    'tokensOutput',
    'totalTokens',
    'estimatedCostUsd',
  ])
  sortBy?:
    | 'createdAt'
    | 'creditsUsed'
    | 'tokensInput'
    | 'tokensOutput'
    | 'totalTokens'
    | 'estimatedCostUsd';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}