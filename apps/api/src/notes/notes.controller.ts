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

@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

@Get()
findAll(
  @CurrentUserDecorator() currentUser: CurrentUser,
  @Query() query: QueryNotesDto,
) {
  return this.notesService.findAll(currentUser, query);
}

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.notesService.findOne(id, currentUser);
  }

  @Post()
  create(
    @Body() dto: CreateNoteDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.notesService.create(dto, currentUser);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.notesService.update(id, dto, currentUser);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.notesService.remove(id, currentUser);
  }
}