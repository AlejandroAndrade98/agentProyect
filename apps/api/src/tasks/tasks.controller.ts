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
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';

import {
  CRM_DELETE_ROLES,
  CRM_READ_ROLES,
  CRM_WRITE_ROLES,
} from '../auth/constants/role-groups';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
@Roles(...CRM_READ_ROLES)
findAll(
  @CurrentUserDecorator() currentUser: CurrentUser,
  @Query() query: QueryTasksDto,
) {
  return this.tasksService.findAll(currentUser, query);
}

@Get(':id')
@Roles(...CRM_READ_ROLES)
findOne(
  @Param('id') id: string,
  @CurrentUserDecorator() currentUser: CurrentUser,
) {
  return this.tasksService.findOne(id, currentUser);
}

@Post()
@Roles(...CRM_WRITE_ROLES)
create(
  @Body() dto: CreateTaskDto,
  @CurrentUserDecorator() currentUser: CurrentUser,
) {
  return this.tasksService.create(dto, currentUser);
}

@Patch(':id')
@Roles(...CRM_WRITE_ROLES)
update(
  @Param('id') id: string,
  @Body() dto: UpdateTaskDto,
  @CurrentUserDecorator() currentUser: CurrentUser,
) {
  return this.tasksService.update(id, dto, currentUser);
}

@Delete(':id')
@Roles(...CRM_DELETE_ROLES)
remove(
  @Param('id') id: string,
  @CurrentUserDecorator() currentUser: CurrentUser,
) {
  return this.tasksService.remove(id, currentUser);
}
}