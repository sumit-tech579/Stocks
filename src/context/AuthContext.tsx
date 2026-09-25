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
  sendEmailVerification,
  sendPasswordResetEmail,
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
  sendPasswordResetCode: (email: string) => Promise<{ error: string | null; message?: string }>;
  verifyPasswordResetCode: (email: string, code: string) => Promise<{ success: boolean; resetAuthToken?: string; error: string | null }>;
  submitNewPassword: (resetAuthToken: string, newPassword: string) => Promise<{ success: boolean; error: string | null; message?: string }>;
  previewVerificationCode: string | null;
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
  const [previewVerificationCode, setPreviewVerificationCode] = useState<string | null>(null);

  // Ensure Firestore user document exists and sync verification status
  // True if either native Firebase Auth confirms it OR Firestore profile confirms it
  const syncUserToFirestore = async (fbUser: FirebaseUser, displayNameFallback?: string): Promise<UserProfile> => {
    const fullName = fbUser.displayName || displayNameFallback || fbUser.email?.split('@')[0] || 'Trader';
    let isVerified = Boolean(fbUser.emailVerified);

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
          const data = userSnap.data();
          if (data?.emailVerified) {
            isVerified = true;
          }
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

    // Auto-reload user profile on window focus (e.g. after user verifies via email link in another tab)
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

      // Trigger verification code / email dispatch
      try {
        const idToken = await userCredential.user.getIdToken();
        const apiRes = await safeFetchJson('/api/auth/send-verification-code', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (apiRes.ok && apiRes.data?.code) {
          setPreviewVerificationCode(apiRes.data.code);
        } else if (!apiRes.ok) {
          await sendEmailVerification(userCredential.user);
          const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
          setPreviewVerificationCode(fallbackCode);
          if (db) {
            const userDocRef = doc(db, 'users', userCredential.user.uid);
            await updateDoc(userDocRef, {
              emailVerificationCode: fallbackCode,
              emailVerificationExpiresAt: Date.now() + 15 * 60 * 1000,
              emailVerificationAttempts: 5,
            });
          }
        }
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
        if (res.data.code) {
          setPreviewVerificationCode(res.data.code);
        }
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

      // Backend unreachable or HTML fallback (static Firebase Hosting deployment):
      // Gracefully fall back to direct Firebase email dispatch and Firestore OTP challenge
      console.warn('[AuthContext] Backend endpoint unreachable; falling back to Firebase email service.');
      try {
        await sendEmailVerification(currentFbUser);
      } catch (fbMailErr) {
        console.warn('Firebase sendEmailVerification notice:', fbMailErr);
      }

      const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000;
      setPreviewVerificationCode(fallbackCode);

      if (db) {
        try {
          const userDocRef = doc(db, 'users', currentFbUser.uid);
          await updateDoc(userDocRef, {
            emailVerificationCode: fallbackCode,
            emailVerificationExpiresAt: expiresAt,
            emailVerificationAttempts: 5,
            updatedAt: serverTimestamp(),
          });
        } catch (dbErr) {
          console.warn('Could not store fallback OTP in Firestore:', dbErr);
        }
      }

      return {
        error: null,
        message: `A verification email has been dispatched to ${currentFbUser.email}. You can verify by entering the 6-digit code or clicking the verification link in your email.`,
      };
    } catch (err: any) {
      return {
        error: err.message || 'Failed to dispatch verification code.',
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
      return { success: false, error: 'Please enter a complete 6-digit verification code.' };
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
        setPreviewVerificationCode(null);
        localStorage.setItem('tradenest_auth_user', JSON.stringify(updated));
        return { success: true, error: null };
      }

      // If backend returned a legitimate failure (e.g. wrong code or expired code)
      if (!res.isHtmlFallback && res.status !== 0 && res.data?.error) {
        return { success: false, error: res.data.error };
      }

      // Direct Firestore validation fallback (for static Firebase Hosting deployments)
      if (db) {
        try {
          const userDocRef = doc(db, 'users', currentFbUser.uid);
          const snap = await getDoc(userDocRef);

          if (snap.exists()) {
            const data = snap.data();
            const storedCode = data?.emailVerificationCode;
            const expiresAt = data?.emailVerificationExpiresAt;
            const attempts = data?.emailVerificationAttempts ?? 5;

            if (!storedCode) {
              return { success: false, error: 'No active verification code found. Please click "Resend Code".' };
            }

            if (expiresAt && Date.now() > Number(expiresAt)) {
              return { success: false, error: 'Verification code has expired. Please click "Resend Code" to request a new one.' };
            }

            if (attempts <= 0) {
              return { success: false, error: 'Maximum attempts exceeded for this code. Please click "Resend Code".' };
            }

            if (cleanEntered !== storedCode) {
              await updateDoc(userDocRef, {
                emailVerificationAttempts: attempts - 1,
              });
              const rem = attempts - 1;
              return {
                success: false,
                error: `Incorrect code. ${rem > 0 ? `${rem} attempts remaining.` : 'Code locked. Please request a new code.'}`,
              };
            }

            // Code is correct! Mark verified in Firestore
            await updateDoc(userDocRef, {
              emailVerified: true,
              emailVerificationCode: null,
              emailVerificationExpiresAt: null,
              updatedAt: serverTimestamp(),
            });

            try {
              await reload(currentFbUser);
              await currentFbUser.getIdToken(true);
            } catch {}

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
            setPreviewVerificationCode(null);
            localStorage.setItem('tradenest_auth_user', JSON.stringify(updated));
            return { success: true, error: null };
          }
        } catch (dbErr: any) {
          return { success: false, error: dbErr.message || 'Verification failed.' };
        }
      }

      return { success: false, error: res.error || 'Verification failed. Please try again.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect to verification service.' };
    }
  };

  // Send Password Reset Code
  const sendPasswordResetCode = async (email: string): Promise<{ error: string | null; message?: string }> => {
    if (isDemo) {
      return { error: null, message: 'If an account exists with this email, a recovery code has been sent.' };
    }

    try {
      const res = await safeFetchJson('/api/auth/send-password-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (res.ok) {
        return { error: null, message: res.data?.message || 'If an account exists with this email, a recovery code has been sent.' };
      }

      // Static fallback: send Firebase password reset email
      if (firebaseAuth) {
        try {
          await sendPasswordResetEmail(firebaseAuth, email.trim().toLowerCase());
        } catch (fbErr: any) {
          console.warn('Firebase sendPasswordResetEmail notice:', fbErr);
        }
      }

      return {
        error: null,
        message: 'If an account exists with this email address, password recovery instructions have been sent to your inbox.',
      };
    } catch (err: any) {
      return { error: err.message || 'Failed to dispatch password recovery request.' };
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
    setPreviewVerificationCode(null);
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
        previewVerificationCode,
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
