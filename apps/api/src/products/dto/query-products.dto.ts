import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryProductsDto extends PaginationQueryDto {
  @IsIn(['name', 'category', 'isActive', 'createdAt', 'updatedAt'])
  @IsOptional()
  sortBy?: 'name' | 'category' | 'isActive' | 'createdAt' | 'updatedAt' =
    'createdAt';

  @IsString()
  @IsOptional()
  category?: string;

  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}