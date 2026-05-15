import { IsOptional, IsString } from 'class-validator';

export class CompanyIncludeQueryDto {
  @IsString()
  @IsOptional()
  include?: string;
}