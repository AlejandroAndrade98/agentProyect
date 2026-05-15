import { IsOptional, IsString } from 'class-validator';

export class ContactIncludeQueryDto {
  @IsString()
  @IsOptional()
  include?: string;
}