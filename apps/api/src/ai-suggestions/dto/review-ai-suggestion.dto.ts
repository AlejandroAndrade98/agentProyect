import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewAiSuggestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}