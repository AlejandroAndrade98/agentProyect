import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyLeadNextStepDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nextStep?: string;
}