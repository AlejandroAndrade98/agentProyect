import { apiRequest } from '@/lib/api/core';
import type {
  CreateTaskInput,
  PaginatedResponse,
  QueryTasksParams,
  Task,
  TaskDetail,
  TaskIncludeQuery,
  UpdateTaskInput,
} from '@/types/crm';

export function getTasks(token: string, query?: QueryTasksParams) {
  return apiRequest<PaginatedResponse<Task>>('/tasks', {
    token,
    query,
  });
}

export function getTaskById(
  token: string,
  id: string,
  query?: TaskIncludeQuery,
) {
  return apiRequest<TaskDetail>(`/tasks/${id}`, {
    token,
    query,
  });
}

export function createTask(token: string, input: CreateTaskInput) {
  return apiRequest<Task>('/tasks', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateTask(token: string, id: string, input: UpdateTaskInput) {
  return apiRequest<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function deleteTask(token: string, id: string) {
  return apiRequest<Task>(`/tasks/${id}`, {
    method: 'DELETE',
    token,
  });
}