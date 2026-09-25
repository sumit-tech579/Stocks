import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { auth, db } from './firebaseAdmin';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendGoogleAccountNoticeEmail,
} from './mailer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const HMAC_SECRET = process.env.CODE_HMAC_SECRET || 'tradenest-secure-otp-secret-key-2025';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Helper: Compute keyed HMAC-SHA256
function computeHmac(payload: string): string {
  return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
}

// Helper: Timing-safe comparison
function timingSafeMatch(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// Middleware: Authenticate Firebase ID Token from Authorization header
async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or malformed Firebase ID token' });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1].trim();

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    (req as any).user = decodedToken;
    next();
  } catch (err: any) {
    console.error('[AuthMiddleware] verifyIdToken failed:', err.message);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session. Please sign in again.' });
  }
}

// =============================================================================
// HEALTH CHECK
// =============================================================================
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'TradeNest Auth Service',
    time: new Date().toISOString(),
    firebaseProject: auth.app.options.projectId || 'tradenest-1cc6b',
  });
});

// =============================================================================
// 1. POST /api/auth/send-verification-code
// Authenticated endpoint: Generates & dispatches 6-digit code to user's registered email
// =============================================================================
app.post('/api/auth/send-verification-code', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const uid = user.uid;

    // Fetch user record directly from Firebase Auth to guarantee authoritative email
    const userRecord = await auth.getUser(uid);
    const email = userRecord.email;

    if (!email) {
      res.status(400).json({ error: 'Authenticated account does not have a registered email address.' });
      return;
    }

    // Check if user is already verified natively
    if (userRecord.emailVerified) {
      res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'Your email address is already verified.',
      });
      return;
    }

    const now = Date.now();
    const challengeRef = db.collection('auth_challenges').doc(`${uid}_email_verification`);
    const existingSnap = await challengeRef.get();

    if (existingSnap.exists) {
      const data = existingSnap.data()!;
      // Enforce 60-second cooldown between resends
      const elapsedSeconds = (now - (data.createdAt || 0)) / 1000;
      if (elapsedSeconds < 60) {
        const waitSec = Math.ceil(60 - elapsedSeconds);
        res.status(429).json({
          error: `Please wait ${waitSec} seconds before requesting a new verification code.`,
          retryAfter: waitSec,
        });
        return;
      }
    }

    // Generate cryptographically secure 6-digit random code
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = computeHmac(`${uid}:${email.toLowerCase()}:${code}:email_verification`);
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes

    // Store only the hashed challenge in Firestore (Backend-only)
    await challengeRef.set({
      uid,
      email: email.toLowerCase(),
      purpose: 'email_verification',
      codeHash,
      createdAt: now,
      expiresAt,
      remainingAttempts: 5,
      used: false,
    });

    // Send transactional email
    try {
      await sendVerificationEmail(email, code);
    } catch (mailErr: any) {
      console.error('[send-verification-code] Mail delivery failed:', mailErr.message);
      res.status(500).json({
        error: 'Unable to send the verification email right now. Please try again.',
      });
      return;
    }

    // Never return the code in the response
    res.json({
      success: true,
      message: 'A 6-digit verification code has been sent to your registered email address.',
      expiresIn: 600,
    });
  } catch (err: any) {
    console.error('[send-verification-code] Error:', err);
    res.status(500).json({ error: 'Unable to send the verification email right now. Please try again.' });
  }
});

// =============================================================================
// 2. POST /api/auth/verify-email-code
// Authenticated endpoint: Verifies 6-digit code and marks native user verified
// =============================================================================
app.post('/api/auth/verify-email-code', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const uid = user.uid;
    const { code } = req.body;

    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      res.status(400).json({ error: 'Please enter a valid 6-digit verification code.' });
      return;
    }

    const cleanCode = code.trim();
    const challengeRef = db.collection('auth_challenges').doc(`${uid}_email_verification`);
    const snap = await challengeRef.get();

    if (!snap.exists) {
      res.status(400).json({ error: 'No active verification code found. Please request a new code.' });
      return;
    }

    const challenge = snap.data()!;
    const now = Date.now();

    if (challenge.used) {
      res.status(400).json({ error: 'This verification code has already been used. Please request a new one.' });
      return;
    }

    if (now > challenge.expiresAt) {
      res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
      return;
    }

    if (challenge.remainingAttempts <= 0) {
      res.status(400).json({ error: 'Maximum attempts exceeded for this code. Please request a new code.' });
      return;
    }

    // Verify user record email
    const userRecord = await auth.getUser(uid);
    const email = userRecord.email;
    if (!email || challenge.email.toLowerCase() !== email.toLowerCase()) {
      res.status(400).json({ error: 'Registered email address has changed. Please request a new verification code.' });
      return;
    }

    // Timing-safe HMAC comparison
    const expectedHash = computeHmac(`${uid}:${email.toLowerCase()}:${cleanCode}:email_verification`);
    const isMatch = timingSafeMatch(challenge.codeHash, expectedHash);

    if (!isMatch) {
      const remaining = challenge.remainingAttempts - 1;
      await challengeRef.update({ remainingAttempts: remaining });

      res.status(400).json({
        error: `Incorrect code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code locked. Please request a new code.'}`,
        remainingAttempts: remaining,
      });
      return;
    }

    // Code is valid! Mark challenge consumed
    await challengeRef.update({
      used: true,
      remainingAttempts: 0,
      verifiedAt: now,
    });

    // Authoritative update: update native Firebase Auth user record
    await auth.updateUser(uid, {
      emailVerified: true,
    });

    // Update user profile document in Firestore
    try {
      await db.collection('users').doc(uid).set(
        {
          emailVerified: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (dbErr) {
      console.warn('[verify-email-code] Could not update users collection, native auth succeeded:', dbErr);
    }

    console.log(`[verify-email-code] Successfully verified email for user ${uid} (${email})`);

    res.json({
      success: true,
      message: 'Email verified successfully! You can now access TradeNest.',
    });
  } catch (err: any) {
    console.error('[verify-email-code] Error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// =============================================================================
// 3. POST /api/auth/change-email
// Authenticated endpoint: Allows unverified user to change their registered email
// =============================================================================
app.post('/api/auth/change-email', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const uid = user.uid;
    const { newEmail } = req.body;

    if (!newEmail || typeof newEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const cleanNewEmail = newEmail.trim().toLowerCase();
    const userRecord = await auth.getUser(uid);

    // Only unverified accounts can change email without re-authentication
    if (userRecord.emailVerified) {
      res.status(400).json({ error: 'Your email address is already verified and cannot be changed here.' });
      return;
    }

    // Update email in Firebase Auth
    await auth.updateUser(uid, {
      email: cleanNewEmail,
      emailVerified: false,
    });

    // Update Firestore user document
    await db.collection('users').doc(uid).set(
      {
        email: cleanNewEmail,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Invalidate old challenge and generate new 6-digit code for the new email
    const now = Date.now();
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = computeHmac(`${uid}:${cleanNewEmail}:${code}:email_verification`);
    const expiresAt = now + 10 * 60 * 1000;

    const challengeRef = db.collection('auth_challenges').doc(`${uid}_email_verification`);
    await challengeRef.set({
      uid,
      email: cleanNewEmail,
      purpose: 'email_verification',
      codeHash,
      createdAt: now,
      expiresAt,
      remainingAttempts: 5,
      used: false,
    });

    // Send email to new address
    try {
      await sendVerificationEmail(cleanNewEmail, code);
    } catch (mailErr: any) {
      console.error('[change-email] Mail delivery failed:', mailErr.message);
      res.status(500).json({
        error: 'Email updated, but unable to send verification code. Please click Resend Code.',
      });
      return;
    }

    res.json({
      success: true,
      message: `Email updated to ${cleanNewEmail}. A verification code has been sent.`,
    });
  } catch (err: any) {
    console.error('[change-email] Error:', err);
    let msg = 'Failed to update email address.';
    if (err.code === 'auth/email-already-exists') {
      msg = 'An account with this email address already exists.';
    }
    res.status(500).json({ error: msg });
  }
});

// =============================================================================
// 4. POST /api/auth/send-password-reset-code
// Public endpoint: Sends 6-digit code for password reset (generic response)
// =============================================================================
app.post('/api/auth/send-password-reset-code', async (req: Request, res: Response) => {
  const genericSuccess = {
    success: true,
    message: 'If an account exists with this email address, a password recovery code has been sent.',
  };

  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user exists in Firebase Auth without revealing to client
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(cleanEmail);
    } catch {
      // User not found: return generic success to prevent account enumeration
      res.json(genericSuccess);
      return;
    }

    const uid = userRecord.uid;

    // Check if user only has Google Sign-In (no password provider)
    const hasPasswordProvider = userRecord.providerData.some((p) => p.providerId === 'password');
    const hasGoogleProvider = userRecord.providerData.some((p) => p.providerId === 'google.com');

    if (!hasPasswordProvider && hasGoogleProvider) {
      try {
        await sendGoogleAccountNoticeEmail(cleanEmail);
      } catch {}
      res.json(genericSuccess);
      return;
    }

    // Check cooldown on active challenge
    const challengeRef = db.collection('auth_challenges').doc(`${uid}_password_reset`);
    const existingSnap = await challengeRef.get();
    const now = Date.now();

    if (existingSnap.exists) {
      const data = existingSnap.data()!;
      const elapsedSeconds = (now - (data.createdAt || 0)) / 1000;
      if (elapsedSeconds < 60) {
        const waitSec = Math.ceil(60 - elapsedSeconds);
        res.status(429).json({
          error: `Please wait ${waitSec} seconds before requesting another recovery code.`,
          retryAfter: waitSec,
        });
        return;
      }
    }

    // Generate secure 6-digit code
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = computeHmac(`${uid}:${cleanEmail}:${code}:password_reset`);
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes

    await challengeRef.set({
      uid,
      email: cleanEmail,
      purpose: 'password_reset',
      codeHash,
      createdAt: now,
      expiresAt,
      remainingAttempts: 5,
      used: false,
    });

    try {
      await sendPasswordResetEmail(cleanEmail, code);
    } catch (mailErr: any) {
      console.error('[send-password-reset-code] Mail delivery failed:', mailErr?.message || mailErr);
      res.status(500).json({ error: 'Unable to send the recovery code email right now. Please try again.' });
      return;
    }

    res.json(genericSuccess);
  } catch (err: any) {
    console.error('[send-password-reset-code] Error:', err);
    res.status(500).json({ error: 'Unable to process password reset request. Please try again later.' });
  }
});

// =============================================================================
// 5. POST /api/auth/verify-password-reset-code
// Public endpoint: Verifies recovery code and exchanges for short-lived resetAuthToken
// =============================================================================
app.post('/api/auth/verify-password-reset-code', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      res.status(400).json({ error: 'Please enter a valid 6-digit recovery code.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(cleanEmail);
    } catch {
      res.status(400).json({ error: 'Invalid or expired recovery code.' });
      return;
    }

    const uid = userRecord.uid;
    const challengeRef = db.collection('auth_challenges').doc(`${uid}_password_reset`);
    const snap = await challengeRef.get();

    if (!snap.exists) {
      res.status(400).json({ error: 'No active recovery code found for this account. Please request a new one.' });
      return;
    }

    const challenge = snap.data()!;
    const now = Date.now();

    if (challenge.used) {
      res.status(400).json({ error: 'This recovery code has already been used. Please request a new one.' });
      return;
    }

    if (now > challenge.expiresAt) {
      res.status(400).json({ error: 'Recovery code has expired. Please request a new one.' });
      return;
    }

    if (challenge.remainingAttempts <= 0) {
      res.status(400).json({ error: 'Maximum attempts exceeded for this code. Please request a new code.' });
      return;
    }

    // Verify HMAC timing-safely
    const expectedHash = computeHmac(`${uid}:${cleanEmail}:${cleanCode}:password_reset`);
    const isMatch = timingSafeMatch(challenge.codeHash, expectedHash);

    if (!isMatch) {
      const remaining = challenge.remainingAttempts - 1;
      await challengeRef.update({ remainingAttempts: remaining });
      res.status(400).json({
        error: `Incorrect recovery code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code locked. Please request a new one.'}`,
        remainingAttempts: remaining,
      });
      return;
    }

    // Code is valid! Consume challenge
    await challengeRef.update({
      used: true,
      remainingAttempts: 0,
      verifiedAt: now,
    });

    // Generate single-use, cryptographically strong reset authorization token (32 bytes)
    const resetAuthToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = now + 15 * 60 * 1000; // 15-minute window to enter new password

    await db.collection('reset_authorizations').doc(resetAuthToken).set({
      uid,
      email: cleanEmail,
      createdAt: now,
      expiresAt: tokenExpiresAt,
      consumed: false,
    });

    res.json({
      success: true,
      message: 'Code verified successfully. You may now choose your new password.',
      resetAuthToken,
    });
  } catch (err: any) {
    console.error('[verify-password-reset-code] Error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// =============================================================================
// 6. POST /api/auth/reset-password
// Public endpoint: Validates resetAuthToken and sets new password
// =============================================================================
app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { resetAuthToken, newPassword } = req.body;

    if (!resetAuthToken || typeof resetAuthToken !== 'string') {
      res.status(400).json({ error: 'Missing reset authorization token. Please start the recovery process again.' });
      return;
    }

    // Password policy validation: minimum 8 chars, at least one letter and one number or symbol
    if (
      !newPassword ||
      typeof newPassword !== 'string' ||
      newPassword.length < 8 ||
      !/[A-Za-z]/.test(newPassword) ||
      !/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)
    ) {
      res.status(400).json({
        error: 'Password must be at least 8 characters long and contain both letters and numbers or symbols.',
      });
      return;
    }

    const authRef = db.collection('reset_authorizations').doc(resetAuthToken);
    const snap = await authRef.get();

    if (!snap.exists) {
      res.status(400).json({ error: 'Invalid or expired reset session. Please request a new recovery code.' });
      return;
    }

    const authData = snap.data()!;
    const now = Date.now();

    if (authData.consumed) {
      res.status(400).json({ error: 'This reset token has already been used. Please request a new code.' });
      return;
    }

    if (now > authData.expiresAt) {
      res.status(400).json({ error: 'Reset session expired. Please request a new recovery code.' });
      return;
    }

    // Consume the token atomically
    await authRef.update({
      consumed: true,
      usedAt: now,
    });

    const uid = authData.uid;
    const email = authData.email;

    // Update password via Firebase Admin SDK
    await auth.updateUser(uid, {
      password: newPassword,
    });

    // Revoke all existing sessions and refresh tokens on other devices
    await auth.revokeRefreshTokens(uid);

    // Send security notification email
    try {
      await sendPasswordChangedEmail(email);
    } catch (mailErr) {
      console.warn('[reset-password] Failed to dispatch confirmation email:', mailErr);
    }

    console.log(`[reset-password] Successfully updated password and revoked tokens for ${uid} (${email})`);

    res.json({
      success: true,
      message: 'Your password has been successfully updated! You can now sign in with your new password.',
    });
  } catch (err: any) {
    console.error('[reset-password] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to update password.' });
  }
});

// Export Express app for Vite dev server middleware integration and Cloud Functions
export { app };
export default app;

// Start standalone Express Server if run directly via tsx server/index.ts
const isDirectRun = process.argv[1]?.includes('server/index') || process.env.RUN_STANDALONE === 'true';
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`[TradeNest Server] Authentication API running on http://localhost:${PORT}`);
  });
}
