import { apiRequest } from '@/lib/api/core';
import type {
  CreateProductInput,
  PaginatedResponse,
  Product,
  QueryProductsParams,
  UpdateProductInput,
} from '@/types/crm';

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