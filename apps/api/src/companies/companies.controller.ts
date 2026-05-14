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

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser as CurrentUserPayload } from '../auth/interfaces/current-user.interface';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { QueryCompaniesDto } from './dto/query-companies.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query() query: QueryCompaniesDto,
  ) {
    return this.companiesService.findAll(currentUser, query);
  }

  @Post()
  create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.companiesService.create(dto, currentUser);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.companiesService.update(id, dto, currentUser);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.companiesService.remove(id, currentUser);
  }
}