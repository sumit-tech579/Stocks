import { onRequest } from 'firebase-functions/v2/https';
import { app } from './app.js';

/**
 * TradeNest Firebase Cloud Functions Authentication Service
 * Serves /api/** routes for:
 * - 6-digit email verification code dispatch and verification
 * - Email address update (change email)
 * - 6-digit password recovery code dispatch, verification, and password reset
 */
export const api = onRequest(
  {
    cors: true,
    maxInstances: 10,
    region: 'us-central1',
  },
  app
);
