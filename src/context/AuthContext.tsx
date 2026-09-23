import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, AuthState } from '../types/auth';
import { 
  auth as firebaseAuth, 
  googleProvider,
  isFirebaseConfigured,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged
} from '../services/firebaseClient';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

interface AuthContextType extends AuthState {
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; message?: string }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null; message?: string }>;
  signOut: () => Promise<void>;
  enableDemoMode: () => void;
  isFirebaseReady: boolean;
  isSupabaseReady: boolean;
  authProvider: 'firebase' | 'supabase' | 'demo';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER: UserProfile = {
  id: 'demo_user',
  email: 'demo.trader@tradenest.in',
  fullName: 'Demo Trader',
  isDemo: true,
  createdAt: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const savedUser = localStorage.getItem('tradenest_auth_user');
      if (savedUser) {
        return JSON.parse(savedUser);
      }
    } catch {
      // fallback
    }
    return DEMO_USER;
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [isDemo, setIsDemo] = useState<boolean>(() => {
    return user?.isDemo ?? true;
  });

  // Track which active provider was used
  const [activeProvider, setActiveProvider] = useState<'firebase' | 'supabase' | 'demo'>(() => {
    if (isFirebaseConfigured) return 'firebase';
    if (isSupabaseConfigured) return 'supabase';
    return 'demo';
  });

  useEffect(() => {
    let mounted = true;

    // 1. If Firebase is configured, listen to Firebase Auth changes
    if (isFirebaseConfigured && firebaseAuth) {
      const unsubscribeFirebase = onAuthStateChanged(firebaseAuth, (fbUser) => {
        if (!mounted) return;
        if (fbUser) {
          const profile: UserProfile = {
            id: fbUser.uid,
            email: fbUser.email || '',
            fullName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Trader',
            isDemo: false,
            avatarUrl: fbUser.photoURL || undefined,
            createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
          };
          setUser(profile);
          setIsDemo(false);
          setActiveProvider('firebase');
          localStorage.setItem('tradenest_auth_user', JSON.stringify(profile));
        } else {
          // If no logged in user and was using Firebase
          if (activeProvider === 'firebase') {
            setUser(DEMO_USER);
            setIsDemo(true);
            setActiveProvider('demo');
            localStorage.setItem('tradenest_auth_user', JSON.stringify(DEMO_USER));
          }
        }
        setLoading(false);
      });

      return () => {
        mounted = false;
        unsubscribeFirebase();
      };
    }

    // 2. If Supabase is configured and Firebase is not, listen to Supabase
    if (isSupabaseConfigured && supabase && !isFirebaseConfigured) {
      async function checkSupabaseSession() {
        try {
          const { data: { session } } = await supabase!.auth.getSession();
          if (session?.user && mounted) {
            const profile: UserProfile = {
              id: session.user.id,
              email: session.user.email || '',
              fullName: session.user.user_metadata?.full_name || 'Trader',
              isDemo: false,
              createdAt: session.user.created_at,
            };
            setUser(profile);
            setIsDemo(false);
            setActiveProvider('supabase');
            localStorage.setItem('tradenest_auth_user', JSON.stringify(profile));
          }
        } catch (err) {
          console.error('Error fetching Supabase session', err);
        } finally {
          if (mounted) setLoading(false);
        }
      }

      checkSupabaseSession();

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const profile: UserProfile = {
            id: session.user.id,
            email: session.user.email || '',
            fullName: session.user.user_metadata?.full_name || 'Trader',
            isDemo: false,
            createdAt: session.user.created_at,
          };
          setUser(profile);
          setIsDemo(false);
          setActiveProvider('supabase');
          localStorage.setItem('tradenest_auth_user', JSON.stringify(profile));
        } else {
          setUser(DEMO_USER);
          setIsDemo(true);
          setActiveProvider('demo');
          localStorage.setItem('tradenest_auth_user', JSON.stringify(DEMO_USER));
        }
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    // 3. Fallback: Demo Mode
    setLoading(false);
  }, [activeProvider]);

  // Sign In with Email & Password (routes to Firebase if available, else Supabase)
  const signInWithPassword = async (email: string, password: string): Promise<{ error: string | null }> => {
    // Try Firebase first
    if (isFirebaseConfigured && firebaseAuth) {
      try {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
        return { error: null };
      } catch (err: any) {
        let msg = err.message || 'Firebase sign-in failed.';
        if (err.code === 'auth/configuration-not-found') {
          msg = 'Firebase Authentication is not fully initialized yet. Please open Firebase Console (Build > Authentication), click "Get started", and enable Email/Password.';
        } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
          msg = 'Invalid email or password. Please check your credentials or create a new account.';
        } else if (err.code === 'auth/too-many-requests') {
          msg = 'Access temporarily disabled due to many failed login attempts. Please reset your password or try again later.';
        }
        return { error: msg };
      }
    }

    // Try Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        return { error: null };
      } catch (e: any) {
        return { error: e.message || 'Supabase sign-in failed.' };
      }
    }

    return { 
      error: 'Authentication backend not configured in .env. Please configure Firebase or Supabase, or use "Try Demo" mode.' 
    };
  };

  // Sign Up with Email & Password
  const signUp = async (email: string, password: string, fullName: string): Promise<{ error: string | null; message?: string }> => {
    // Try Firebase
    if (isFirebaseConfigured && firebaseAuth) {
      try {
        const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        if (fullName && userCredential.user) {
          await updateProfile(userCredential.user, { displayName: fullName });
        }
        return { error: null, message: 'Account registered successfully with Firebase! ₹1,00,000 virtual cash credited.' };
      } catch (err: any) {
        let msg = err.message || 'Firebase registration failed.';
        if (err.code === 'auth/configuration-not-found') {
          msg = 'Firebase Authentication is not fully initialized yet. Please open Firebase Console (Build > Authentication), click "Get started", and enable Email/Password.';
        } else if (err.code === 'auth/email-already-in-use') {
          msg = 'This email is already registered. Please sign in instead.';
        } else if (err.code === 'auth/weak-password') {
          msg = 'Password should be at least 6 characters.';
        }
        return { error: msg };
      }
    }

    // Try Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });

        if (error) return { error: error.message };
        if (data.session) {
          return { error: null, message: 'Account created successfully!' };
        }
        return { error: null, message: 'Registration email sent. Please confirm your account.' };
      } catch (e: any) {
        return { error: e.message || 'Registration failed.' };
      }
    }

    return { 
      error: 'Authentication backend not configured in .env. Please configure Firebase or Supabase, or use "Try Demo" mode.' 
    };
  };

  // Sign In with Google (Firebase)
  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    if (isFirebaseConfigured && firebaseAuth && googleProvider) {
      try {
        await signInWithPopup(firebaseAuth, googleProvider);
        return { error: null };
      } catch (err: any) {
        let msg = err.message || 'Google sign-in failed.';
        if (err.code === 'auth/configuration-not-found') {
          msg = 'Google Sign-In is not enabled yet in your Firebase Console. Please go to Build > Authentication > Sign-in method, click Google, and enable it.';
        } else if (err.code === 'auth/popup-closed-by-user') {
          msg = 'Sign-in window closed before completing.';
        }
        return { error: msg };
      }
    }

    return { 
      error: 'Firebase is not configured in .env with valid API keys. Google Sign-In requires Firebase.' 
    };
  };

  // Reset Password
  const resetPassword = async (email: string): Promise<{ error: string | null; message?: string }> => {
    if (isFirebaseConfigured && firebaseAuth) {
      try {
        await sendPasswordResetEmail(firebaseAuth, email);
        return { error: null, message: 'Password reset link sent to your email by Firebase.' };
      } catch (err: any) {
        return { error: err.message || 'Failed to send password reset email.' };
      }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/account',
        });
        if (error) return { error: error.message };
        return { error: null, message: 'Password reset link sent to your email.' };
      } catch (e: any) {
        return { error: e.message || 'Error sending password reset email.' };
      }
    }

    return { 
      error: 'Authentication backend not configured in .env. Password reset is not available in offline Demo Mode.' 
    };
  };

  // Sign Out
  const signOut = async (): Promise<void> => {
    if (isFirebaseConfigured && firebaseAuth) {
      try {
        await firebaseSignOut(firebaseAuth);
      } catch (err) {
        console.error('Error signing out of Firebase', err);
      }
    }

    if (isSupabaseConfigured && supabase && !isDemo) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Error signing out of Supabase', err);
      }
    }

    setUser(DEMO_USER);
    setIsDemo(true);
    setActiveProvider('demo');
    localStorage.setItem('tradenest_auth_user', JSON.stringify(DEMO_USER));
  };

  // Explicit Demo Mode
  const enableDemoMode = (): void => {
    setUser(DEMO_USER);
    setIsDemo(true);
    setActiveProvider('demo');
    localStorage.setItem('tradenest_auth_user', JSON.stringify(DEMO_USER));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemo,
        isFirebaseReady: isFirebaseConfigured,
        isSupabaseReady: isSupabaseConfigured,
        authProvider: activeProvider,
        signInWithPassword,
        signUp,
        signInWithGoogle,
        resetPassword,
        signOut,
        enableDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
