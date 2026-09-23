export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  isDemo: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  isDemo: boolean;
}
