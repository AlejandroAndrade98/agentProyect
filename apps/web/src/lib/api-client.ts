import type { LoginCredentials, LoginResponse } from '@/types/auth';
import { apiRequest } from '@/lib/api/core';
import type {
  Company,
  CompanyDetail,
  CompanyIncludeQuery,
  Contact,
  ContactDetail,
  ContactIncludeQuery,
  CreateCompanyInput,
  CreateContactInput,
  PaginatedResponse,
  QueryCompaniesParams,
  QueryContactsParams,
  UpdateCompanyInput,
  UpdateContactInput,
  CreateLeadInput,
  Lead,
  LeadDetail,
  LeadIncludeQuery,
  QueryLeadsParams,
  UpdateLeadInput,
  CreateTaskInput,
  QueryTasksParams,
  Task,
  TaskDetail,
  TaskIncludeQuery,
  UpdateTaskInput,
  CreateProductInput,
  Product,
  QueryProductsParams,
  UpdateProductInput,
  CreateNoteInput,
  Note,
  NoteDetail,
  NoteIncludeQuery,
  QueryNotesParams,
  UpdateNoteInput,
} from '@/types/crm';
import type {
  DashboardLeadsOverview,
  DashboardRecentActivity,
  DashboardRecentActivityQuery,
  DashboardSummary,
  DashboardTasksOverview,
} from '@/types/dashboard';

import type { ActivityEvent, ActivityEventsQuery } from '@/types/activity';
import type { CurrentUser } from '@/types/user';


export function login(credentials: LoginCredentials) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: credentials,
  });
}

export function getMe(token: string) {
  return apiRequest<CurrentUser>('/users/me', {
    token,
  });
}

export function getDashboardSummary(token: string) {
  return apiRequest<DashboardSummary>('/dashboard/summary', {
    token,
  });
}

export function getDashboardLeads(token: string) {
  return apiRequest<DashboardLeadsOverview>('/dashboard/leads', {
    token,
  });
}

export function getDashboardTasks(token: string) {
  return apiRequest<DashboardTasksOverview>('/dashboard/tasks', {
    token,
  });
}

export function getDashboardRecentActivity(
  token: string,
  query?: DashboardRecentActivityQuery,
) {
  return apiRequest<DashboardRecentActivity>('/dashboard/recent-activity', {
    token,
    query,
  });
}

export function getCompanies(token: string, query?: QueryCompaniesParams) {
  return apiRequest<PaginatedResponse<Company>>('/companies', {
    token,
    query,
  });
}

export function getCompanyById(
  token: string,
  id: string,
  query?: CompanyIncludeQuery,
) {
  return apiRequest<CompanyDetail>(`/companies/${id}`, {
    token,
    query,
  });
}

export function createCompany(token: string, input: CreateCompanyInput) {
  return apiRequest<Company>('/companies', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateCompany(
  token: string,
  id: string,
  input: UpdateCompanyInput,
) {
  return apiRequest<Company>(`/companies/${id}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function deleteCompany(token: string, id: string) {
  return apiRequest<Company>(`/companies/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function getContacts(token: string, query?: QueryContactsParams) {
  return apiRequest<PaginatedResponse<Contact>>('/contacts', {
    token,
    query,
  });
}

export function getContactById(
  token: string,
  id: string,
  query?: ContactIncludeQuery,
) {
  return apiRequest<ContactDetail>(`/contacts/${id}`, {
    token,
    query,
  });
}

export function createContact(token: string, input: CreateContactInput) {
  return apiRequest<Contact>('/contacts', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateContact(
  token: string,
  id: string,
  input: UpdateContactInput,
) {
  return apiRequest<Contact>(`/contacts/${id}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function deleteContact(token: string, id: string) {
  return apiRequest<Contact>(`/contacts/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function getLeads(token: string, query?: QueryLeadsParams) {
  return apiRequest<PaginatedResponse<Lead>>('/leads', {
    token,
    query,
  });
}

export function getLeadById(
  token: string,
  id: string,
  query?: LeadIncludeQuery,
) {
  return apiRequest<LeadDetail>(`/leads/${id}`, {
    token,
    query,
  });
}

export function createLead(token: string, input: CreateLeadInput) {
  return apiRequest<Lead>('/leads', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateLead(token: string, id: string, input: UpdateLeadInput) {
  return apiRequest<Lead>(`/leads/${id}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function deleteLead(token: string, id: string) {
  return apiRequest<Lead>(`/leads/${id}`, {
    method: 'DELETE',
    token,
  });
}

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

export function getProducts(token: string, query?: QueryProductsParams) {
  return apiRequest<PaginatedResponse<Product>>('/products', {
    token,
    query,
  });
}

export function getProductById(token: string, id: string) {
  return apiRequest<Product>(`/products/${id}`, {
    token,
  });
}

export function createProduct(token: string, input: CreateProductInput) {
  return apiRequest<Product>('/products', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateProduct(
  token: string,
  id: string,
  input: UpdateProductInput,
) {
  return apiRequest<Product>(`/products/${id}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function deleteProduct(token: string, id: string) {
  return apiRequest<Product>(`/products/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function getNotes(token: string, query?: QueryNotesParams) {
  return apiRequest<PaginatedResponse<Note>>('/notes', {
    token,
    query,
  });
}

export function getNoteById(
  token: string,
  id: string,
  query?: NoteIncludeQuery,
) {
  return apiRequest<NoteDetail>(`/notes/${id}`, {
    token,
    query,
  });
}

export function createNote(token: string, input: CreateNoteInput) {
  return apiRequest<Note>('/notes', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateNote(token: string, id: string, input: UpdateNoteInput) {
  return apiRequest<Note>(`/notes/${id}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function deleteNote(token: string, id: string) {
  return apiRequest<Note>(`/notes/${id}`, {
    method: 'DELETE',
    token,
  });
}

export async function getActivityEvents(
  token: string,
  query: ActivityEventsQuery = {},
) {
  return apiRequest<PaginatedResponse<ActivityEvent>>('/activity-events', {
    method: 'GET',
    token,
    query,
  });
}

export { ApiClientError } from '@/lib/api/core';