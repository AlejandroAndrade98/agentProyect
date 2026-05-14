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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser as CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}
  
@Get()
findAll(
  @CurrentUserDecorator() currentUser: CurrentUser,
  @Query() query: QueryLeadsDto,
) {
  return this.leadsService.findAll(currentUser, query);
}

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.leadsService.findOne(id, currentUser);
  }

  @Post()
  create(
    @Body() dto: CreateLeadDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.leadsService.create(dto, currentUser);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.leadsService.update(id, dto, currentUser);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.leadsService.remove(id, currentUser);
  }
}