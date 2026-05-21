import { TaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class MoveTaskBoardDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  boardPosition?: number;
}