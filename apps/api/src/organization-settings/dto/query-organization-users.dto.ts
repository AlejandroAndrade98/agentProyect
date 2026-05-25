import { IsBooleanString, IsEnum, IsIn, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryOrganizationUsersDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @IsOptional()
  @IsIn(['createdAt', 'email', 'name', 'role'])
  sortBy?: 'createdAt' | 'email' | 'name' | 'role';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}