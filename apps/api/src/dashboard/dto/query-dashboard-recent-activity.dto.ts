import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ActivityEventType } from '@prisma/client';

export class QueryDashboardRecentActivityDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  limit?: number = 10;

  @IsEnum(ActivityEventType)
  @IsOptional()
  type?: ActivityEventType;
}