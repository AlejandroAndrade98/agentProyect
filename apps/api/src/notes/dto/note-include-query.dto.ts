import { IsOptional, IsString } from 'class-validator';

export class NoteIncludeQueryDto {
  @IsString()
  @IsOptional()
  include?: string;
}