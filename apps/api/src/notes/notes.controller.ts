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
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { QueryNotesDto } from './dto/query-notes.dto';

import {
  CRM_DELETE_ROLES,
  CRM_READ_ROLES,
  CRM_WRITE_ROLES,
} from '../auth/constants/role-groups';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

import { NoteIncludeQueryDto } from './dto/note-include-query.dto';

@Controller('notes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

@Get()
@Roles(...CRM_READ_ROLES)
findAll(
  @CurrentUserDecorator() currentUser: CurrentUser,
  @Query() query: QueryNotesDto,
) {
  return this.notesService.findAll(currentUser, query);
}

  @Get(':id')
  @Roles(...CRM_READ_ROLES)
  findOne(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
    @Query() query: NoteIncludeQueryDto,
  ) {
    return this.notesService.findOne(id, currentUser, query);
  }

  @Post()
  @Roles(...CRM_WRITE_ROLES)
  create(
    @Body() dto: CreateNoteDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.notesService.create(dto, currentUser);
  }

  @Patch(':id')
  @Roles(...CRM_WRITE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.notesService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @Roles(...CRM_DELETE_ROLES)
  remove(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.notesService.remove(id, currentUser);
  }
}