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
  sendPasswordResetEmail,
  sendEmailVerification,
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
  const syncUserToFirestore = async (fbUser: FirebaseUser, displayNameFallback?: string): Promise<UserProfile> => {
    const fullName = fbUser.displayName || displayNameFallback || fbUser.email?.split('@')[0] || 'Trader';
    const profile: UserProfile = {
      id: fbUser.uid,
      uid: fbUser.uid,
      email: fbUser.email || '',
      fullName,
      isDemo: false,
      avatarUrl: fbUser.photoURL || undefined,
      photoURL: fbUser.photoURL || undefined,
      emailVerified: fbUser.emailVerified,
      createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
    };

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
            emailVerified: fbUser.emailVerified,
            virtualCash: 100000,
            reservedCash: 0,
            realizedPnl: 0,
            watchlist: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'TATAMOTORS'],
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          });
        } else {
          // Existing profile: NEVER overwrite balance or trades!
          await updateDoc(userDocRef, {
            emailVerified: fbUser.emailVerified,
            photoURL: fbUser.photoURL || null,
            lastLoginAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Firestore user profile sync error (using local cache):', err);
      }
    }

    return profile;
  };

  useEffect(() => {
    let mounted = true;

    if (!isFirebaseConfigured || !firebaseAuth) {
      // If Firebase credentials are missing in .env, default to demo mode
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
          // If we had a real user before, clear out on sign out
          const wasRealUser = user && !user.isDemo;
          if (wasRealUser) {
            setUser(null);
            setIsDemo(false);
            localStorage.removeItem('tradenest_auth_user');
          } else if (!user) {
            // No user stored at all
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

      // Send email verification
      try {
        await sendEmailVerification(userCredential.user);
      } catch (verificationErr) {
        console.warn('Could not send email verification immediately:', verificationErr);
      }

      // Initialize Firestore document with ₹1,00,000 virtual cash
      const profile = await syncUserToFirestore(userCredential.user, fullName);
      setUser(profile);
      setIsDemo(false);
      localStorage.setItem('tradenest_auth_user', JSON.stringify(profile));

      return { 
        error: null, 
        message: 'Account created successfully! We sent a verification link to your email, and ₹1,00,000 in virtual cash has been credited to your account.' 
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

  // Send Password Reset Email
  const resetPassword = async (email: string): Promise<{ error: string | null; message?: string }> => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      return { 
        error: 'Firebase is not configured in .env. Password reset requires Firebase configuration.' 
      };
    }

    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      return { 
        error: null, 
        message: 'A password reset link has been sent to your email. Please check your inbox and spam folder.' 
      };
    } catch (err: any) {
      let msg = err.message || 'Failed to send password reset email.';
      if (err.code === 'auth/user-not-found') {
        msg = 'No registered account found with this email.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      return { error: msg };
    }
  };

  // Resend Email Verification
  const resendVerificationEmail = async (): Promise<{ error: string | null; message?: string }> => {
    if (!firebaseAuth?.currentUser) {
      return { error: 'No signed-in user found. Please sign in first.' };
    }

    try {
      await sendEmailVerification(firebaseAuth.currentUser);
      return { error: null, message: 'Verification email resent successfully! Please check your inbox.' };
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        return { error: 'Too many requests. Please wait a minute before requesting another verification email.' };
      }
      return { error: err.message || 'Failed to resend verification email.' };
    }
  };

  // Reload Current User Profile & Check Verification Status
  const reloadUserProfile = async (): Promise<void> => {
    if (firebaseAuth?.currentUser) {
      try {
        await reload(firebaseAuth.currentUser);
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
