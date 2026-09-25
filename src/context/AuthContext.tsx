import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, AuthState } from '../types/auth';
import { 
  auth as firebaseAuth, 
  db,
  googleProvider,
  isFirebaseConfigured,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  firebaseSignOut,
  updateProfile,
  onAuthStateChanged,
  reload,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  FirebaseUser
} from '../services/firebaseClient';

interface AuthContextType extends AuthState {
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; message?: string }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null; message?: string }>;
  resendVerificationEmail: () => Promise<{ error: string | null; message?: string }>;
  sendVerificationCode: () => Promise<{ error: string | null; message?: string; retryAfter?: number }>;
  verifyEmailCode: (enteredCode: string) => Promise<{ success: boolean; error: string | null }>;
  sendPasswordResetCode: (email: string) => Promise<{ error: string | null; message?: string }>;
  verifyPasswordResetCode: (email: string, code: string) => Promise<{ success: boolean; resetAuthToken?: string; error: string | null }>;
  submitNewPassword: (resetAuthToken: string, newPassword: string) => Promise<{ success: boolean; error: string | null; message?: string }>;
  reloadUserProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  enableDemoMode: () => void;
  isFirebaseReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER: UserProfile = {
  id: 'demo_user',
  uid: 'demo_user',
  email: 'demo.trader@tradenest.in',
  fullName: 'Demo Trader',
  isDemo: true,
  emailVerified: true,
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
      // Ignore parse errors
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [isDemo, setIsDemo] = useState<boolean>(() => {
    return user?.isDemo ?? false;
  });

  // Ensure Firestore user document exists and credit virtual money once
  // Firebase Auth's fbUser.emailVerified is the authoritative source of truth
  const syncUserToFirestore = async (fbUser: FirebaseUser, displayNameFallback?: string): Promise<UserProfile> => {
    const fullName = fbUser.displayName || displayNameFallback || fbUser.email?.split('@')[0] || 'Trader';
    const isVerified = fbUser.emailVerified;

    if (db) {
      try {
        const userDocRef = doc(db, 'users', fbUser.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          // First time registration or Google sign-in: Initialize ₹1,00,000 virtual balance
          await setDoc(userDocRef, {
            uid: fbUser.uid,
            displayName: fullName,
            email: fbUser.email || '',
            photoURL: fbUser.photoURL || null,
            emailVerified: isVerified,
            virtualCash: 100000,
            reservedCash: 0,
            realizedPnl: 0,
            watchlist: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'TATAMOTORS'],
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          });
        } else {
          await updateDoc(userDocRef, {
            emailVerified: isVerified,
            photoURL: fbUser.photoURL || null,
            lastLoginAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Firestore user profile sync error (using local cache):', err);
      }
    }

    const profile: UserProfile = {
      id: fbUser.uid,
      uid: fbUser.uid,
      email: fbUser.email || '',
      fullName,
      isDemo: false,
      avatarUrl: fbUser.photoURL || undefined,
      photoURL: fbUser.photoURL || undefined,
      emailVerified: isVerified,
      createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
    };

    return profile;
  };

  useEffect(() => {
    let mounted = true;

    if (!isFirebaseConfigured || !firebaseAuth) {
      if (mounted) {
        if (!user) {
          setUser(DEMO_USER);
          setIsDemo(true);
        }
        setLoading(false);
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (!mounted) return;

      if (fbUser) {
        const profile = await syncUserToFirestore(fbUser);
        if (mounted) {
          setUser(profile);
          setIsDemo(false);
          localStorage.setItem('tradenest_auth_user', JSON.stringify(profile));
          setLoading(false);
        }
      } else {
        if (mounted) {
          const wasRealUser = user && !user.isDemo;
          if (wasRealUser) {
            setUser(null);
            setIsDemo(false);
            localStorage.removeItem('tradenest_auth_user');
          } else if (!user) {
            setUser(null);
            setIsDemo(false);
          }
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [isFirebaseConfigured]);

  // Sign In with Email & Password
  const signInWithPassword = async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      return { 
        error: 'Firebase is not configured in .env. Please configure Firebase API keys or use Demo Mode.' 
      };
    }

    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const profile = await syncUserToFirestore(userCredential.user);
      setUser(profile);
      setIsDemo(false);
      localStorage.setItem('tradenest_auth_user', JSON.stringify(profile));
      return { error: null };
    } catch (err: any) {
      let msg = err.message || 'Firebase sign-in failed.';
      if (err.code === 'auth/configuration-not-found') {
        msg = 'Firebase Authentication is not fully initialized. Please open Firebase Console (Build > Authentication), click "Get started", and enable Email/Password.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        msg = 'Invalid email or password. Please check your credentials or create a new account.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Access temporarily disabled due to many failed login attempts. Please reset your password or try again later.';
      }
      return { error: msg };
    }
  };

  // Sign Up with Email, Password & Full Name
  const signUp = async (email: string, password: string, fullName: string): Promise<{ error: string | null; message?: string }> => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      return { 
        error: 'Firebase is not configured in .env. Please configure Firebase API keys or use Demo Mode.' 
      };
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      
      // Update display name
      if (fullName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName: fullName });
      }

      // Initialize Firestore document with ₹1,00,000 virtual cash
      const profile = await syncUserToFirestore(userCredential.user, fullName);
      setUser(profile);
      setIsDemo(false);
      localStorage.setItem('tradenest_auth_user', JSON.stringify(profile));

      // Trigger the backend to dispatch the first 6-digit verification code
      try {
        const idToken = await userCredential.user.getIdToken();
        await fetch('/api/auth/send-verification-code', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (sendErr) {
        console.warn('Initial verification code dispatch triggered:', sendErr);
      }

      return { 
        error: null, 
        message: 'Account created successfully! A 6-digit verification code has been sent to your email.' 
      };
    } catch (err: any) {
      let msg = err.message || 'Firebase registration failed.';
      if (err.code === 'auth/configuration-not-found') {
        msg = 'Firebase Authentication is not fully initialized. Please enable Email/Password in the Firebase Console.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters long.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      return { error: msg };
    }
  };

  // Sign In with Google
  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    if (!isFirebaseConfigured || !firebaseAuth || !googleProvider) {
      return { 
        error: 'Firebase is not configured in .env. Google Sign-In requires Firebase configuration.' 
      };
    }

    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const profile = await syncUserToFirestore(result.user);
      setUser(profile);
      setIsDemo(false);
      localStorage.setItem('tradenest_auth_user', JSON.stringify(profile));
      return { error: null };
    } catch (err: any) {
      let msg = err.message || 'Google sign-in failed.';
      if (err.code === 'auth/configuration-not-found') {
        msg = 'Google Sign-In is not enabled yet in your Firebase Console. Please go to Build > Authentication > Sign-in method, click Google, and enable it.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in window closed before completing.';
      } else if (err.code === 'auth/cancelled-popup-request') {
        msg = 'Only one Google sign-in window can be open at a time.';
      }
      return { error: msg };
    }
  };

  // Request 6-Digit Verification Code from backend
  const sendVerificationCode = async (): Promise<{ error: string | null; message?: string; retryAfter?: number }> => {
    if (isDemo) {
      return { error: null, message: 'Demo mode: verification email simulated.' };
    }

    const currentFbUser = firebaseAuth?.currentUser;
    if (!currentFbUser) {
      return { error: 'No active session found. Please sign in.' };
    }

    try {
      const idToken = await currentFbUser.getIdToken();
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          error: data.error || 'Failed to send verification code.',
          retryAfter: data.retryAfter,
        };
      }

      return {
        error: null,
        message: data.message || 'A 6-digit verification code has been dispatched to your email.',
      };
    } catch (err: any) {
      return {
        error: err.message || 'Failed to connect to authentication server. Please check your connection.',
      };
    }
  };

  // Verify 6-Digit Email Code via backend API
  const verifyEmailCode = async (enteredCode: string): Promise<{ success: boolean; error: string | null }> => {
    if (isDemo) {
      return { success: true, error: null };
    }

    const currentFbUser = firebaseAuth?.currentUser;
    if (!currentFbUser) {
      return { success: false, error: 'User session not found. Please sign in.' };
    }

    const cleanEntered = enteredCode.trim().replace(/\s+/g, '');
    if (cleanEntered.length !== 6) {
      return { success: false, error: 'Please enter a complete 6-digit verification code.' };
    }

    try {
      const idToken = await currentFbUser.getIdToken();
      const res = await fetch('/api/auth/verify-email-code', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: cleanEntered }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Invalid verification code.' };
      }

      // Authoritative reload: update Firebase Auth user and force-refresh claims
      await reload(currentFbUser);
      await currentFbUser.getIdToken(true);

      if (user) {
        const updated: UserProfile = {
          ...user,
          emailVerified: true,
        };
        setUser(updated);
        localStorage.setItem('tradenest_auth_user', JSON.stringify(updated));
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect to verification service.' };
    }
  };

  // Send Password Reset 6-Digit Code
  const sendPasswordResetCode = async (email: string): Promise<{ error: string | null; message?: string }> => {
    if (isDemo) {
      return { error: null, message: 'If an account exists with this email, a recovery code has been sent.' };
    }

    try {
      const res = await fetch('/api/auth/send-password-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Failed to send password recovery code.' };
      }

      return { error: null, message: data.message };
    } catch (err: any) {
      return { error: err.message || 'Failed to connect to recovery service.' };
    }
  };

  // Verify 6-Digit Password Reset Code and exchange for resetAuthToken
  const verifyPasswordResetCode = async (
    email: string,
    code: string
  ): Promise<{ success: boolean; resetAuthToken?: string; error: string | null }> => {
    if (isDemo) {
      return { success: true, resetAuthToken: 'demo-token', error: null };
    }

    try {
      const res = await fetch('/api/auth/verify-password-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Invalid or expired recovery code.' };
      }

      return {
        success: true,
        resetAuthToken: data.resetAuthToken,
        error: null,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Verification service error.' };
    }
  };

  // Submit New Password with resetAuthToken
  const submitNewPassword = async (
    resetAuthToken: string,
    newPassword: string
  ): Promise<{ success: boolean; error: string | null; message?: string }> => {
    if (isDemo) {
      return { success: true, error: null, message: 'Password updated successfully!' };
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetAuthToken, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update password.' };
      }

      return { success: true, error: null, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server error while resetting password.' };
    }
  };

  // Legacy resetPassword alias
  const resetPassword = async (email: string): Promise<{ error: string | null; message?: string }> => {
    return sendPasswordResetCode(email);
  };

  // Legacy resendVerificationEmail alias
  const resendVerificationEmail = async (): Promise<{ error: string | null; message?: string }> => {
    const res = await sendVerificationCode();
    return { error: res.error, message: res.message };
  };

  // Reload Current User Profile & Check Verification Status
  const reloadUserProfile = async (): Promise<void> => {
    if (firebaseAuth?.currentUser) {
      try {
        await reload(firebaseAuth.currentUser);
        await firebaseAuth.currentUser.getIdToken(true);
        const fbUser = firebaseAuth.currentUser;
        const updated = await syncUserToFirestore(fbUser);
        setUser(updated);
        localStorage.setItem('tradenest_auth_user', JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to reload Firebase user:', err);
      }
    }
  };

  // Sign Out
  const signOut = async (): Promise<void> => {
    if (firebaseAuth) {
      try {
        await firebaseSignOut(firebaseAuth);
      } catch (err) {
        console.error('Error signing out of Firebase:', err);
      }
    }

    // Clear user cached authentication state
    setUser(null);
    setIsDemo(false);
    localStorage.removeItem('tradenest_auth_user');
  };

  // Enable Demo Mode
  const enableDemoMode = (): void => {
    setUser(DEMO_USER);
    setIsDemo(true);
    localStorage.setItem('tradenest_auth_user', JSON.stringify(DEMO_USER));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemo,
        isFirebaseReady: isFirebaseConfigured,
        signInWithPassword,
        signUp,
        signInWithGoogle,
        resetPassword,
        resendVerificationEmail,
        sendVerificationCode,
        verifyEmailCode,
        sendPasswordResetCode,
        verifyPasswordResetCode,
        submitNewPassword,
        reloadUserProfile,
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
