export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'SALES_REP' | 'VIEWER';

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