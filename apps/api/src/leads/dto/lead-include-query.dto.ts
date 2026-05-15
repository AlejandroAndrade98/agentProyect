import { IsOptional, IsString } from 'class-validator';

export class LeadIncludeQueryDto {
  @IsString()
  @IsOptional()
  include?: string;
}