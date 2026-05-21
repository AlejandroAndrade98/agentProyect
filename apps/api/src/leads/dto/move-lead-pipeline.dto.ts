import { LeadStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class MoveLeadPipelineDto {
  @IsEnum(LeadStatus)
  status!: LeadStatus;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  pipelinePosition?: number;
}