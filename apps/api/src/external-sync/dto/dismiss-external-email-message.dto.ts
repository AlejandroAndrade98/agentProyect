import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DismissExternalEmailMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
