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
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll(@CurrentUserDecorator() currentUser: CurrentUser) {
    return this.companiesService.findAll(currentUser);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.companiesService.findOne(id, currentUser);
  }

  @Post()
  create(
    @Body() dto: CreateCompanyDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.companiesService.create(dto, currentUser);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.companiesService.update(id, dto, currentUser);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.companiesService.remove(id, currentUser);
  }
}