import {
  IsBooleanString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { OrganizationAccountType, OrganizationStatus } from '@prisma/client';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryPlatformOrganizationsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrganizationAccountType)
  accountType?: OrganizationAccountType;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsBooleanString()
  aiEnabled?: string;

  @IsOptional()
  @IsIn([
    'createdAt',
    'updatedAt',
    'name',
    'status',
    'accountType',
    'aiCreditsBalance',
    'aiMonthlyCreditsLimit',
  ])
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'name'
    | 'status'
    | 'accountType'
    | 'aiCreditsBalance'
    | 'aiMonthlyCreditsLimit';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}