import { OrganizationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdatePlatformOrganizationStatusDto {
  @IsEnum(OrganizationStatus)
  status!: OrganizationStatus;

  @IsOptional()
  @IsString()
  statusReason?: string;
}