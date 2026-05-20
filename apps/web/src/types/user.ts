export type UserRole =
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'ADMIN'
  | 'SALES'
  | 'VIEWER';

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  organizationId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};