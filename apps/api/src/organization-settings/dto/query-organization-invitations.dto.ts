import { OrganizationInvitationStatus, Role } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryOrganizationInvitationsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrganizationInvitationStatus)
  status?: OrganizationInvitationStatus;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsIn(['createdAt', 'email', 'role', 'status', 'expiresAt'])
  sortBy?: 'createdAt' | 'email' | 'role' | 'status' | 'expiresAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}