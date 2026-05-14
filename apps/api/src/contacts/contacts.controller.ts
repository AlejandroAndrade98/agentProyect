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

import { CurrentUser as CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  findAll(
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Query() query: QueryContactsDto,
  ) {
    return this.contactsService.findAll(currentUser, query);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.contactsService.findOne(id, currentUser);
  }

  @Post()
  create(
    @Body() dto: CreateContactDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.contactsService.create(dto, currentUser);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.contactsService.update(id, dto, currentUser);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.contactsService.remove(id, currentUser);
  }
}