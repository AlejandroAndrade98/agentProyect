import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CRM_READ_ROLES, PRODUCT_MANAGE_ROLES } from '../auth/constants/role-groups';
import { CurrentUser as CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles(...CRM_READ_ROLES)
  findAll(
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Query() query: QueryProductsDto,
  ) {
    return this.productsService.findAll(currentUser, query);
  }

  @Get(':id')
  @Roles(...CRM_READ_ROLES)
  findOne(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.productsService.findOne(id, currentUser);
  }

  @Post()
  @Roles(...PRODUCT_MANAGE_ROLES)
  create(
    @Body() dto: CreateProductDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.productsService.create(dto, currentUser);
  }

  @Patch(':id')
  @Roles(...PRODUCT_MANAGE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.productsService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @Roles(...PRODUCT_MANAGE_ROLES)
  remove(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.productsService.remove(id, currentUser);
  }
}