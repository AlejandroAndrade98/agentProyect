import type { SortOrder } from './common';

export type Product = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateProductInput = {
  name: string;
  description?: string;
  category?: string;
  isActive?: boolean;
};

export type UpdateProductInput = Partial<CreateProductInput>;

export type QueryProductsParams = Record<
  string,
  string | number | boolean | undefined
> & {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: 'name' | 'category' | 'isActive' | 'createdAt' | 'updatedAt';
  sortOrder?: SortOrder;
  isActive?: boolean;
  category?: string;
};