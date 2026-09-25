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
import { safeFetchJson } from '../utils/apiClient';

interface AuthContextType extends AuthState {
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; message?: string }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null; message?: string }>;
  resendVerificationEmail: () => Promise<{ error: string | null; message?: string }>;
  sendVerificationCode: () => Promise<{ error: string | null; message?: string; retryAfter?: number }>;
  verifyEmailCode: (enteredCode: string) => Promise<{ success: boolean; error: string | null }>;
  changeEmail: (newEmail: string) => Promise<{ error: string | null; message?: string }>;
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

  // Ensure Firestore user document exists and sync verification status
  // Firebase Authentication's emailVerified value is the authoritative source of truth
  const syncUserToFirestore = async (fbUser: FirebaseUser, displayNameFallback?: string): Promise<UserProfile> => {
    const fullName = fbUser.displayName || displayNameFallback || fbUser.email?.split('@')[0] || 'Trader';
    const isVerified = Boolean(fbUser.emailVerified);

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
            email: fbUser.email || '',
            emailVerified: isVerified,
            photoURL: fbUser.photoURL || null,
            lastLoginAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Firestore user profile sync notice:', err);
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
        // Authoritative: reload user to get fresh emailVerified status on startup
        try {
          await reload(fbUser);
        } catch {}
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

    // Auto-reload user profile on window focus (e.g. after user verifies via email)
    const handleWindowFocus = () => {
      if (firebaseAuth?.currentUser) {
        reloadUserProfile();
      }
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener('focus', handleWindowFocus);
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
      // Reload user to ensure latest verification status
      await reload(userCredential.user);
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
      
      if (fullName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName: fullName });
      }

      // Initialize Firestore document with ₹1,00,000 virtual cash
      const profile = await syncUserToFirestore(userCredential.user, fullName);
      setUser(profile);
      setIsDemo(false);
      localStorage.setItem('tradenest_auth_user', JSON.stringify(profile));

      // Trigger verification code dispatch to the exact registered email
      try {
        const idToken = await userCredential.user.getIdToken();
        await safeFetchJson('/api/auth/send-verification-code', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (sendErr) {
        console.warn('Initial verification dispatch notice:', sendErr);
      }

      return { 
        error: null, 
        message: 'Account created successfully! A verification code has been dispatched to your email.' 
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

  // Sign In with Google (Google emails are pre-verified by Google)
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

  // Request 6-Digit Verification Code
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
      const res = await safeFetchJson('/api/auth/send-verification-code', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok && res.data) {
        return {
          error: null,
          message: res.data.message || 'A 6-digit verification code has been dispatched to your email.',
        };
      }

      if (res.status === 429) {
        return {
          error: res.data?.error || 'Please wait before requesting another code.',
          retryAfter: res.data?.retryAfter,
        };
      }

      // Honest error reporting - never claim success if delivery failed
      return {
        error: res.data?.error || res.error || 'Unable to send the verification email right now. Please try again.',
      };
    } catch (err: any) {
      return {
        error: err.message || 'Unable to send the verification email right now. Please try again.',
      };
    }
  };

  // Verify 6-Digit Email Code
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
      return { success: false, error: 'Please enter all 6 digits of the verification code.' };
    }

    try {
      const idToken = await currentFbUser.getIdToken();
      const res = await safeFetchJson('/api/auth/verify-email-code', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: cleanEntered }),
      });

      if (res.ok) {
        // Authoritative reload: update Firebase Auth user and force-refresh claims
        await reload(currentFbUser);
        await currentFbUser.getIdToken(true);

        const updated: UserProfile = {
          ...(user || {
            id: currentFbUser.uid,
            uid: currentFbUser.uid,
            email: currentFbUser.email || '',
            fullName: currentFbUser.displayName || 'Trader',
            isDemo: false,
            createdAt: currentFbUser.metadata.creationTime || new Date().toISOString(),
          }),
          emailVerified: true,
        };
        setUser(updated);
        localStorage.setItem('tradenest_auth_user', JSON.stringify(updated));
        return { success: true, error: null };
      }

      return {
        success: false,
        error: res.data?.error || res.error || 'Invalid verification code. Please check and try again.',
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect to verification service.' };
    }
  };

  // Change Email Address and automatically dispatch a fresh code
  const changeEmail = async (newEmail: string): Promise<{ error: string | null; message?: string }> => {
    if (isDemo) {
      return { error: null, message: 'Demo mode: email updated.' };
    }

    const currentFbUser = firebaseAuth?.currentUser;
    if (!currentFbUser) {
      return { error: 'No active session found. Please sign in.' };
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return { error: 'Please enter a valid email address.' };
    }

    try {
      const idToken = await currentFbUser.getIdToken();
      const res = await safeFetchJson('/api/auth/change-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newEmail: cleanEmail }),
      });

      if (res.ok) {
        // Reload Firebase user and force refresh ID token
        await reload(currentFbUser);
        await currentFbUser.getIdToken(true);

        const updatedProfile = await syncUserToFirestore(currentFbUser);
        setUser(updatedProfile);
        localStorage.setItem('tradenest_auth_user', JSON.stringify(updatedProfile));

        return {
          error: null,
          message: res.data?.message || `Email address updated to ${cleanEmail}. A new 6-digit verification code has been dispatched.`,
        };
      }

      return {
        error: res.data?.error || res.error || 'Unable to update email address. Please try again.',
      };
    } catch (err: any) {
      return {
        error: err.message || 'Unable to update email address. Please try again.',
      };
    }
  };

  // Send Password Reset Code
  const sendPasswordResetCode = async (email: string): Promise<{ error: string | null; message?: string }> => {
    if (isDemo) {
      return { error: null, message: 'If an account exists with this email, a recovery code has been sent.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { error: 'Please enter a valid email address.' };
    }

    try {
      const res = await safeFetchJson('/api/auth/send-password-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (res.ok) {
        return {
          error: null,
          message: res.data?.message || 'A 6-digit recovery code has been dispatched to your email address.',
        };
      }

      if (res.status === 429) {
        return {
          error: res.data?.error || 'Please wait before requesting another recovery code.',
        };
      }

      return {
        error: res.data?.error || res.error || 'Unable to send 6-digit recovery code. Please ensure the authentication service is configured.',
      };
    } catch (err: any) {
      return {
        error: err.message || 'Unable to send 6-digit recovery code. Please try again.',
      };
    }
  };

  // Verify Password Reset Code
  const verifyPasswordResetCode = async (
    email: string,
    code: string
  ): Promise<{ success: boolean; resetAuthToken?: string; error: string | null }> => {
    if (isDemo) {
      return { success: true, resetAuthToken: 'demo-token', error: null };
    }

    try {
      const res = await safeFetchJson('/api/auth/verify-password-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
        }),
      });

      if (res.ok && res.data?.resetAuthToken) {
        return {
          success: true,
          resetAuthToken: res.data.resetAuthToken,
          error: null,
        };
      }

      return {
        success: false,
        error: res.data?.error || res.error || 'Invalid or expired recovery code.',
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Verification service error.' };
    }
  };

  // Submit New Password
  const submitNewPassword = async (
    resetAuthToken: string,
    newPassword: string
  ): Promise<{ success: boolean; error: string | null; message?: string }> => {
    if (isDemo) {
      return { success: true, error: null, message: 'Password updated successfully!' };
    }

    try {
      const res = await safeFetchJson('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetAuthToken, newPassword }),
      });

      if (res.ok) {
        return { success: true, error: null, message: res.data?.message || 'Password updated successfully!' };
      }

      return { success: false, error: res.data?.error || res.error || 'Failed to update password.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server error while resetting password.' };
    }
  };

  // Legacy aliases
  const resetPassword = async (email: string): Promise<{ error: string | null; message?: string }> => {
    return sendPasswordResetCode(email);
  };

  const resendVerificationEmail = async (): Promise<{ error: string | null; message?: string }> => {
    return sendVerificationCode();
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
        changeEmail,
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
