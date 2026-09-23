# TradeNest - Complete Firebase Authentication & Security Setup Guide

This guide provides clear, beginner-friendly instructions to configure Firebase Authentication and Cloud Firestore for TradeNest.

---

## 1. Create a Firebase Project & Register Web App

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or select your existing project, e.g. `tradenest-1cc6b`).
3. Enter a project name (e.g. `tradenest`) and follow the on-screen steps.
4. Once the project dashboard is ready, click the **Web icon** (`</>`) to register a new Web App:
   - App nickname: `TradeNest Web`
   - Check the box **"Also set up Firebase Hosting for this app"** (optional, recommended).
   - Click **Register app**.
5. Copy the configuration keys shown in the `firebaseConfig` snippet.

---

## 2. Enable Email/Password & Google Authentication

In your Firebase Console:

### A. Enable Email/Password
1. In the left navigation sidebar, navigate to **Build > Authentication**.
2. Click **Get started** (if not already started).
3. Under the **Sign-in method** tab, click **Email/Password**.
4. Toggle **Email/Password** to **Enabled**.
5. Leave "Email link (passwordless sign-in)" disabled unless desired.
6. Click **Save**.

### B. Enable Google Sign-In
1. Under the **Sign-in method** tab, click **Add new provider** and select **Google**.
2. Toggle the switch to **Enabled**.
3. Select your **Project support email** from the dropdown.
4. Click **Save**.

---

## 3. Configure Authorised Domains

Firebase Authentication requires domain authorization to allow Google Sign-in and email redirects.

1. In **Build > Authentication**, click the **Settings** tab.
2. Click **Authorized domains** in the sub-navigation.
3. Verify that the following domains are listed (click **Add domain** if missing):
   - `localhost`
   - `127.0.0.1`
   - `<your-project-id>.firebaseapp.com` (e.g. `tradenest-1cc6b.firebaseapp.com`)
   - `<your-project-id>.web.app` (e.g. `tradenest-1cc6b.web.app`)
   - If deploying to **Vercel**, add your Vercel preview and production domains (e.g. `tradenest.vercel.app`, `*.vercel.app`).

---

## 4. Create Cloud Firestore Database & Deploy Security Rules

### A. Create Cloud Firestore in the Console
1. In the left sidebar, navigate to **Build > Firestore Database**.
2. Click **Create database**.
3. Choose your database location (e.g. `asia-south1` for Mumbai, or `nam5` / `us-central1`).
4. Select **Start in production mode** and click **Create**.

### B. Deploy Firestore Security Rules
TradeNest includes a pre-configured `firestore.rules` file in the project root:

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
      allow update: if isOwner(userId)
        && request.resource.data.uid == userId;
      allow delete: if false;

      match /holdings/{symbol} {
        allow read, write: if isOwner(userId);
      }
      match /orders/{orderId} {
        allow read, write: if isOwner(userId);
      }
      match /transactions/{transactionId} {
        allow read, write: if isOwner(userId);
      }
      match /watchlist/{item} {
        allow read, write: if isOwner(userId);
      }
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

You can deploy these rules using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```
Or paste the contents directly in **Firestore Database > Rules** tab in the Firebase Console and click **Publish**.

---

## 5. Configure Environment Variables

### A. Local Development (`.env`)
Create or edit `.env` in the root directory:
```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### B. Vercel Deployment
1. Go to your project on [Vercel Dashboard](https://vercel.com).
2. Navigate to **Settings > Environment Variables**.
3. Add the 6 variables listed above for `Production`, `Preview`, and `Development`.
4. Trigger a redeploy.

> [!WARNING]
> **Security Reminder**: Never commit your `.env` file to GitHub or expose Firebase Admin private keys in client code. The frontend only requires public client SDK variables prefixed with `VITE_`.

---

## 6. Run and Test Locally

### Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 7. Verification Checklist

| Test Scenario | Steps to Verify | Expected Outcome |
|---|---|---|
| **1. Protected Route Guard** | Open incognito window and visit `http://localhost:3000/` or `/portfolio` | Instantly redirects to `/signin` with zero flash of protected user content. |
| **2. Email Registration** | Navigate to `/signup`, fill in Full Name, Email, Password, and Confirm Password | Account created, ₹1,00,000 credited once in Firestore profile, verification email sent, redirected to `/verify-email`. |
| **3. Email Verification** | Check mailbox for verification link; click "I've Verified / Refresh Status" | Status updates to "Verified Email" with green badge in Account menu. |
| **4. Password Reset** | Visit `/forgot-password`, enter registered email, click "Send Reset Link" | Success alert displayed; reset email delivered to mailbox. |
| **5. Google Sign-In** | On `/signin`, click "Continue with Google" | Google popup window authenticates user; profile created in Firestore with avatar; redirected to destination URL. |
| **6. User Data Isolation** | **User A** logs in and buys 10 shares of RELIANCE. User A signs out. **User B** logs in | User B sees an empty portfolio with ₹1,00,000 cash. User A's holdings and orders are strictly inaccessible. |
| **7. Persistent Session** | Log in, navigate to `/portfolio`, reload the page (`F5`) | User remains logged in; state loads cleanly without logging out. |
| **8. Sign Out Flow** | Click avatar dropdown or visit `/account`, click "Sign Out" | Session destroyed, local in-memory cache cleared, redirected to `/signin`. |
