import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser as CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@CurrentUserDecorator() currentUser: CurrentUser) {
    return this.productsService.findAll(currentUser);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.productsService.findOne(id, currentUser);
  }

  @Post()
  create(
    @Body() dto: CreateProductDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.productsService.create(dto, currentUser);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.productsService.update(id, dto, currentUser);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.productsService.remove(id, currentUser);
  }
}