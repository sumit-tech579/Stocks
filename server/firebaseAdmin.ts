import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables from .env if present
dotenv.config();

let app: App;
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'tradenest-1cc6b';

if (!getApps().length) {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccountKey) {
      try {
        let credentials: any;
        if (serviceAccountKey.trim().startsWith('{')) {
          credentials = JSON.parse(serviceAccountKey);
        } else if (fs.existsSync(serviceAccountKey)) {
          credentials = JSON.parse(fs.readFileSync(serviceAccountKey, 'utf-8'));
        }

        if (credentials) {
          app = initializeApp({
            credential: cert(credentials),
            projectId,
          });
          console.log('[FirebaseAdmin] Initialized with Service Account Credentials.');
        } else {
          app = initializeApp({ projectId });
          console.log(`[FirebaseAdmin] Initialized for project ${projectId}.`);
        }
      } catch (err) {
        console.warn('[FirebaseAdmin] Failed to parse service account key string, falling back to default credentials:', err);
        app = initializeApp({ projectId });
      }
    } else {
      app = initializeApp({ projectId });
      console.log(`[FirebaseAdmin] Initialized for project ${projectId}.`);
    }
  } catch (err) {
    console.error('[FirebaseAdmin] Initialization error:', err);
    app = initializeApp({ projectId });
  }
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export { app };
export default app;
