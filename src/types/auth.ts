export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  isDemo: boolean;
  avatarUrl?: string;
  photoURL?: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  isDemo: boolean;
}
