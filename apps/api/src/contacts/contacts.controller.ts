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

import {
  CRM_DELETE_ROLES,
  CRM_READ_ROLES,
  CRM_WRITE_ROLES,
} from '../auth/constants/role-groups';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

 @Get()
@Roles(...CRM_READ_ROLES)
findAll(
  @CurrentUserDecorator() currentUser: CurrentUser,
  @Query() query: QueryContactsDto,
) {
  return this.contactsService.findAll(currentUser, query);
}

@Get(':id')
@Roles(...CRM_READ_ROLES)
findOne(
  @Param('id') id: string,
  @CurrentUserDecorator() currentUser: CurrentUser,
) {
  return this.contactsService.findOne(id, currentUser);
}

@Post()
@Roles(...CRM_WRITE_ROLES)
create(
  @Body() dto: CreateContactDto,
  @CurrentUserDecorator() currentUser: CurrentUser,
) {
  return this.contactsService.create(dto, currentUser);
}

@Patch(':id')
@Roles(...CRM_WRITE_ROLES)
update(
  @Param('id') id: string,
  @Body() dto: UpdateContactDto,
  @CurrentUserDecorator() currentUser: CurrentUser,
) {
  return this.contactsService.update(id, dto, currentUser);
}

@Delete(':id')
@Roles(...CRM_DELETE_ROLES)
remove(
  @Param('id') id: string,
  @CurrentUserDecorator() currentUser: CurrentUser,
) {
  return this.contactsService.remove(id, currentUser);
}
}