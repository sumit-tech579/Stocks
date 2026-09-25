# TradeNest - Complete Firebase Authentication & 6-Digit OTP Setup Guide

This guide provides clear instructions to configure Firebase Authentication, Cloud Firestore, and the secure Backend Authentication Service for TradeNest.

---

## 1. Overview & Architecture

### The Email Verification Root Cause & Fix
- **The Bug**: Previously, client-side code updated `emailVerified: true` in Firestore (`users/{uid}`), but could not update Firebase Authentication's native `user.emailVerified` property on Google's identity servers. Every time `auth.currentUser.reload()` or page refreshes ran, Google's server record (`false`) overrode local state, keeping users in an unverified loop.
- **The Solution**:
  1. The backend server verifies the 6-digit code entered by the user.
  2. The backend calls `admin.auth().updateUser(uid, { emailVerified: true })` using the Firebase Admin SDK.
  3. The frontend then calls `await auth.currentUser.reload()` and `await auth.currentUser.getIdToken(true)` to force-refresh the native JWT claims.
  4. The frontend and protected routes treat `auth.currentUser.emailVerified` as the authoritative source of truth.
  5. Verified users proceed straight to the dashboard (`/`), while unverified users are held at `/verify-email` without redirect loops.

---

## 2. Firebase Console Configuration

### A. Enable Email/Password
1. Go to the [Firebase Console](https://console.firebase.google.com/) and open your project (`tradenest-1cc6b`).
2. In the left navigation, go to **Build > Authentication**.
3. Under the **Sign-in method** tab, click **Email/Password**.
4. Enable **Email/Password** and click **Save**.

### B. Enable Google Sign-In
1. Under **Sign-in method**, click **Add new provider** and choose **Google**.
2. Toggle to **Enabled**, choose your project support email, and click **Save**.

### C. Authorized Domains
In **Authentication > Settings > Authorized domains**, make sure the following are added:
- `localhost`
- `127.0.0.1`
- `tradenest-1cc6b.firebaseapp.com`
- `tradenest-1cc6b.web.app`

---

## 3. Cloud Firestore & Security Rules

### A. Database Initialization
1. In the left sidebar, navigate to **Build > Firestore Database**.
2. Click **Create database**, choose **Production mode**, and pick your preferred region (e.g. `asia-south1` or `us-central1`).

### B. Security Rules
The updated `firestore.rules` file locks down backend authentication collections (`auth_challenges`, `reset_authorizations`, `rate_limits`) so that clients can **never** read, modify, or forge challenges:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    match /users/{userId} {
      allow read: if isOwner(userId);
      allow create: if isOwner(userId) 
        && request.resource.data.uid == userId
        && request.resource.data.virtualCash is number;
      allow update: if isOwner(userId) && request.resource.data.uid == userId;
      allow delete: if false;

      match /{subcollection=**} {
        allow read, write: if isOwner(userId);
      }
    }

    // Backend-only authentication collections (Zero direct client access)
    match /auth_challenges/{challengeId} { allow read, write: if false; }
    match /reset_authorizations/{token} { allow read, write: if false; }
    match /rate_limits/{limitId} { allow read, write: if false; }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Deploy the rules to Firebase:
```bash
firebase deploy --only firestore:rules
```

---

## 4. Backend Authentication Service & SMTP Setup

TradeNest includes a secure Express backend service (`server/index.ts`) providing:
1. `POST /api/auth/send-verification-code`: Validates ID token, generates 6-digit OTP, stores keyed HMAC-SHA256, dispatches transactional email.
2. `POST /api/auth/verify-email-code`: Timing-safe HMAC verification, rate-limiting (max 5 attempts, 10-min expiry), sets `emailVerified: true` via Admin SDK.
3. `POST /api/auth/send-password-reset-code`: Anti-enumeration generic endpoint, verifies user and provider, sends recovery OTP.
4. `POST /api/auth/verify-password-reset-code`: Exchanges valid OTP for single-use `resetAuthToken`.
5. `POST /api/auth/reset-password`: Server-enforced password policy, Admin password update, revokes all active refresh tokens (`revokeRefreshTokens`), dispatches security confirmation email.

### SMTP Email Configuration
In `.env`, configure your SMTP credentials to send transactional emails:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_digit_app_password
SMTP_FROM="TradeNest <your_email@gmail.com>"
```

> [!NOTE]
> **Development Preview**: In local development without SMTP credentials set, the server logs the exact 6-digit code and dispatch preview directly into the server terminal, so you can test complete end-to-end flows immediately.

---

## 5. Running the Application Locally

Run the backend server and frontend Vite app:

### Terminal 1: Backend Server (Port 3001)
```bash
npm run server
```

### Terminal 2: Frontend Client (Port 3000)
```bash
npm run dev
```

The Vite dev server automatically proxies `/api` requests to `http://localhost:3001`.

---

## 6. Verification Checklist

| Test Scenario | Steps to Verify | Expected Outcome |
|---|---|---|
| **1. Unverified User Guard** | Register or log in with unverified account; try visiting `/` or `/portfolio` | Redirected to `/verify-email`. |
| **2. Incorrect 6-Digit Code** | Enter `000000` on `/verify-email` | Code rejected; displays "Incorrect code. 4 attempts remaining." |
| **3. Correct 6-Digit Code** | Enter correct 6-digit code from email | Admin SDK marks user verified; ID token force-refreshed; confetti triggers; redirected to Dashboard. |
| **4. Verified User Guard** | Visit `/verify-email` while verified | Immediately redirected to Dashboard without loops. |
| **5. 60-Second Cooldown** | Click "Resend Code" on `/verify-email` | Resend cooldown timer counts down from 60 seconds. |
| **6. Multi-Step Password Reset** | Visit `/forgot-password`, enter email -> enter 6-digit OTP -> set new password | Password updated; old sessions revoked; security confirmation email dispatched. |
| **7. Google-Only Protection** | Request reset for Google account | Security email explains Google Sign-In; no unwanted password provider added. |
