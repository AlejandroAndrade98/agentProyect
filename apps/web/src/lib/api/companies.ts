import { apiRequest } from '@/lib/api/core';
import type {
  Company,
  CompanyDetail,
  CompanyIncludeQuery,
  CreateCompanyInput,
  PaginatedResponse,
  QueryCompaniesParams,
  UpdateCompanyInput,
} from '@/types/crm';

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