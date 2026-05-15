import { IsOptional, IsString } from 'class-validator';

export class TaskIncludeQueryDto {
  @IsString()
  @IsOptional()
  include?: string;
}