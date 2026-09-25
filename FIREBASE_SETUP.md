# TradeNest - Complete Firebase Authentication & 6-Digit OTP Setup Guide

This guide provides instructions to configure Firebase Authentication, Cloud Firestore, Firebase Cloud Functions, and Real Transactional Email Delivery (Resend API or SMTP) for TradeNest.

---

## 1. Overview & Architecture

### The Email Verification Root Cause & Production Fix
- **The Bug**: Previously, client-side code attempted to update `emailVerified: true` in Firestore or local state, but could not update Firebase Authentication's native `user.emailVerified` property on Google's identity servers. Every time `auth.currentUser.reload()` or page refreshes ran, Google's server record (`false`) overrode local state, keeping users in an unverified loop. Furthermore, Firebase's default email service only sends verification links, never 6-digit OTP codes.
- **The Complete Solution**:
  1. The user registers with Full Name, Email, and Password.
  2. Firebase Authentication creates the account.
  3. The backend generates a secure cryptographically random 6-digit code.
  4. The code is stored as a keyed HMAC-SHA256 hash in Firestore (`auth_challenges/{uid}_email_verification`) with a 10-minute expiry and 5-attempt rate-limiting.
  5. The backend dispatches the code via **Resend API** or **Nodemailer SMTP** to the exact registered email address.
  6. **Zero-Exposure Policy**: The 6-digit code is **never** returned in API responses, never shown in dev tools, and never stored in browser storage.
  7. The user enters the 6 digits in TradeNest's numeric OTP input.
  8. Upon validation, the backend uses the Firebase Admin SDK to update the authoritative status:
     `admin.auth().updateUser(uid, { emailVerified: true })`.
  9. The frontend reloads the user (`await user.reload()`), force-refreshes the ID token (`await user.getIdToken(true)`), updates app state, and redirects to the trading dashboard.
  10. If the user mistyped their email during signup, they can use the **Change Email** button on `/verify-email` to correct it and receive a fresh code immediately.

---

## 2. Transactional Email Provider Setup

Choose either **Option A (Resend - Recommended)** or **Option B (Gmail SMTP)**:

### Option A: Resend API (Recommended - 1 Minute Setup)
Resend uses standard HTTPS REST calls, avoiding all ISP and cloud SMTP port blocks (such as port 25/465/587).
1. Go to [resend.com](https://resend.com) and create a free account.
2. Go to **API Keys** and click **Create API Key**.
3. Copy the key (starts with `re_`).
4. Add to your `.env` (or Firebase Functions environment):
   ```env
   EMAIL_PROVIDER_API_KEY=re_your_api_key_here
   EMAIL_FROM_ADDRESS=onboarding@resend.dev
   EMAIL_FROM_NAME="TradeNest Security"
   ```
   *(Note: `onboarding@resend.dev` delivers instantly to your Resend account email for testing. When you add a custom domain in Resend, you can send to any email address).*

### Option B: Gmail App Password (Free SMTP)
1. Go to your [Google Account Security Settings](https://myaccount.google.com/security).
2. Ensure **2-Step Verification** is turned ON.
3. Search for **App passwords** (or go to [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
4. Create a new app password named `TradeNest`.
5. Google will generate a 16-character password (e.g. `abcd efgh ijkl mnop`).
6. Add to your `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=abcdefghijklmnop
   SMTP_FROM="TradeNest Security <your_email@gmail.com>"
   ```

---

## 3. Firebase Console Configuration

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

## 4. Cloud Firestore & Security Rules

### A. Database Initialization
1. In the left sidebar, navigate to **Build > Firestore Database**.
2. Click **Create database**, choose **Production mode**, and pick your preferred region (e.g. `asia-south1` or `us-central1`).

### B. Security Rules
The `firestore.rules` file locks down backend authentication collections (`auth_challenges`, `reset_authorizations`, `rate_limits`) so that clients can **never** read, modify, or forge challenges:

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

Deploy rules to Firebase:
```bash
firebase deploy --only firestore:rules
```

---

## 5. Local Development vs Cloud Functions Deployment

### Running Locally (Full Stack with Vite + Express)
1. Set up your `.env` file with your Firebase web credentials and Email credentials (`EMAIL_PROVIDER_API_KEY` or `SMTP_USER`/`SMTP_PASS`).
2. Run backend and frontend:
   - **Terminal 1**: `npm run server` (starts Express API on port 3001)
   - **Terminal 2**: `npm run dev` (starts Vite on port 3000, proxies `/api` to 3001)

### Deploying to Firebase Hosting & Cloud Functions
1. Build the frontend:
   ```bash
   npm run build
   ```
2. Build the Cloud Functions:
   ```bash
   cd functions && npm run build && cd ..
   ```
3. Deploy to Firebase:
   ```bash
   firebase deploy --only hosting,functions
   ```

---

## 6. Verification Checklist

| Test Scenario | Steps to Verify | Expected Outcome |
|---|---|---|
| **1. Zero Exposure** | Inspect API network response on code request | Response contains `{ success: true, message: "..." }`. The 6-digit code is NEVER in payload or storage. |
| **2. Unverified Guard** | Register account; try visiting `/` or `/portfolio` | Redirected to `/verify-email`. |
| **3. Incorrect 6-Digit Code** | Enter `000000` on `/verify-email` | Code rejected; displays "Incorrect verification code. 4 attempts remaining." |
| **4. Correct 6-Digit Code** | Enter 6-digit code from email | Admin SDK sets `emailVerified: true`; ID token refreshed; confetti triggers; redirected to Dashboard. |
| **5. Change Email Flow** | Click "Change" next to email on `/verify-email`, enter corrected email | Email updated in Firebase Auth; fresh code sent to new email; boxes reset. |
| **6. Verified User Guard** | Visit `/verify-email` while verified | Immediately redirected to Dashboard without loops. |
| **7. 60-Second Cooldown** | Click "Resend Code" on `/verify-email` | Resend cooldown timer counts down from 60 seconds. |
| **8. Multi-Step Password Reset** | Visit `/forgot-password`, enter email -> enter 6-digit OTP -> set new password | Password updated; old sessions revoked; security confirmation email dispatched. |
