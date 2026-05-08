export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}
