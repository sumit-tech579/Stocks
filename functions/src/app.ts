import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { auth, db } from './firebaseAdmin.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendGoogleAccountNoticeEmail,
} from './mailer.js';

const app = express();
const HMAC_SECRET = process.env.CODE_HMAC_SECRET || 'tradenest-secure-otp-secret-key-2025';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Support both /api/... (hosting rewrite) and /... (direct function invoke)
app.use((req, _res, next) => {
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

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

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'TradeNest Cloud Functions Auth API',
    time: new Date().toISOString(),
  });
});

// 1. Send verification code
app.post('/api/auth/send-verification-code', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const uid = user.uid;

    const userRecord = await auth.getUser(uid);
    const email = userRecord.email;

    if (!email) {
      res.status(400).json({ error: 'Authenticated account does not have a registered email address.' });
      return;
    }

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

    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = computeHmac(`${uid}:${email.toLowerCase()}:${code}:email_verification`);
    const expiresAt = now + 10 * 60 * 1000;

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

    try {
      await sendVerificationEmail(email, code);
    } catch (mailErr: any) {
      console.error('[send-verification-code] Mail delivery failed:', mailErr.message);
      res.status(500).json({
        error: 'Unable to send the verification email right now. Please try again.',
      });
      return;
    }

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

// 2. Verify email code
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

    const userRecord = await auth.getUser(uid);
    const email = userRecord.email;
    if (!email || challenge.email.toLowerCase() !== email.toLowerCase()) {
      res.status(400).json({ error: 'Registered email address has changed. Please request a new verification code.' });
      return;
    }

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

    await challengeRef.update({
      used: true,
      remainingAttempts: 0,
      verifiedAt: now,
    });

    await auth.updateUser(uid, {
      emailVerified: true,
    });

    try {
      await db.collection('users').doc(uid).set(
        {
          emailVerified: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {}

    res.json({
      success: true,
      message: 'Email verified successfully! You can now access TradeNest.',
    });
  } catch (err: any) {
    console.error('[verify-email-code] Error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// 3. Change email
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

    if (userRecord.emailVerified) {
      res.status(400).json({ error: 'Your email address is already verified and cannot be changed here.' });
      return;
    }

    await auth.updateUser(uid, {
      email: cleanNewEmail,
      emailVerified: false,
    });

    await db.collection('users').doc(uid).set(
      {
        email: cleanNewEmail,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

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
    res.status(500).json({ error: 'Failed to update email address.' });
  }
});

// 4. Send password reset code
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
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(cleanEmail);
    } catch {
      res.json(genericSuccess);
      return;
    }

    const uid = userRecord.uid;
    const hasPasswordProvider = userRecord.providerData.some((p) => p.providerId === 'password');
    const hasGoogleProvider = userRecord.providerData.some((p) => p.providerId === 'google.com');

    if (!hasPasswordProvider && hasGoogleProvider) {
      try {
        await sendGoogleAccountNoticeEmail(cleanEmail);
      } catch {}
      res.json(genericSuccess);
      return;
    }

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

    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = computeHmac(`${uid}:${cleanEmail}:${code}:password_reset`);
    const expiresAt = now + 10 * 60 * 1000;

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
    } catch {}

    res.json(genericSuccess);
  } catch (err: any) {
    res.status(500).json({ error: 'Unable to process password reset request.' });
  }
});

// 5. Verify password reset code
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
      res.status(400).json({ error: 'No active recovery code found for this account.' });
      return;
    }

    const challenge = snap.data()!;
    const now = Date.now();

    if (challenge.used || now > challenge.expiresAt || challenge.remainingAttempts <= 0) {
      res.status(400).json({ error: 'Recovery code has expired or was already used.' });
      return;
    }

    const expectedHash = computeHmac(`${uid}:${cleanEmail}:${cleanCode}:password_reset`);
    const isMatch = timingSafeMatch(challenge.codeHash, expectedHash);

    if (!isMatch) {
      const remaining = challenge.remainingAttempts - 1;
      await challengeRef.update({ remainingAttempts: remaining });
      res.status(400).json({ error: `Incorrect recovery code. ${remaining} attempts remaining.` });
      return;
    }

    await challengeRef.update({ used: true, remainingAttempts: 0, verifiedAt: now });

    const resetAuthToken = crypto.randomBytes(32).toString('hex');
    await db.collection('reset_authorizations').doc(resetAuthToken).set({
      uid,
      email: cleanEmail,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000,
      consumed: false,
    });

    res.json({ success: true, resetAuthToken });
  } catch (err: any) {
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// 6. Reset password
app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { resetAuthToken, newPassword } = req.body;
    if (!resetAuthToken || !newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'Invalid password. Must be at least 8 characters long.' });
      return;
    }

    const authRef = db.collection('reset_authorizations').doc(resetAuthToken);
    const snap = await authRef.get();

    if (!snap.exists || snap.data()!.consumed || Date.now() > snap.data()!.expiresAt) {
      res.status(400).json({ error: 'Reset session expired. Please request a new recovery code.' });
      return;
    }

    await authRef.update({ consumed: true, usedAt: Date.now() });
    const { uid, email } = snap.data()!;

    await auth.updateUser(uid, { password: newPassword });
    await auth.revokeRefreshTokens(uid);

    try {
      await sendPasswordChangedEmail(email);
    } catch {}

    res.json({ success: true, message: 'Password updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

export { app };
export default app;
