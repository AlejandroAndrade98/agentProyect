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

import {
  CRM_DELETE_ROLES,
  CRM_READ_ROLES,
  CRM_WRITE_ROLES,
} from '../auth/constants/role-groups';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser as CurrentUserPayload } from '../auth/interfaces/current-user.interface';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { QueryCompaniesDto } from './dto/query-companies.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

import { CompanyIncludeQueryDto } from './dto/company-include-query.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Roles(...CRM_READ_ROLES)
  findAll(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query() query: QueryCompaniesDto,
  ) {
    return this.companiesService.findAll(currentUser, query);
  }

@Get(':id')
@Roles(...CRM_READ_ROLES)
findOne(
  @Param('id') id: string,
  @CurrentUser() currentUser: CurrentUserPayload,
  @Query() query: CompanyIncludeQueryDto,
) {
  return this.companiesService.findOne(id, currentUser, query);
}

  @Post()
  @Roles(...CRM_WRITE_ROLES)
  create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.companiesService.create(dto, currentUser);
  }

  @Patch(':id')
  @Roles(...CRM_WRITE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.companiesService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @Roles(...CRM_DELETE_ROLES)
  remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.companiesService.remove(id, currentUser);
  }
}