// firebase-admin v12+ removed the namespaced API (admin.auth(), admin.credential.cert(),
// admin.apps). Use the modular entry points instead.
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getMessaging } = require('firebase-admin/messaging');
const logger = require('../utils/logger');

let firebaseApp = null;

class FirebaseConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FirebaseConfigError';
    this.isFirebaseConfigError = true;
  }
}

function resolveProjectId() {
  return process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || null;
}

function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  const existing = getApps();
  if (existing.length > 0) {
    firebaseApp = existing[0];
    return firebaseApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = resolveProjectId();

  if (serviceAccountJson) {
    try {
      const credentials = JSON.parse(serviceAccountJson);
      firebaseApp = initializeApp({
        credential: cert(credentials),
        projectId: credentials.project_id || projectId || undefined,
      });
      logger.info('Firebase Admin initialized from service account JSON');
      return firebaseApp;
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to initialize from FIREBASE_SERVICE_ACCOUNT_JSON; falling back to project ID');
    }
  }

  if (projectId) {
    // Verifying ID tokens only needs the project ID (to check aud/iss);
    // no service account credentials are required for that.
    firebaseApp = initializeApp({ projectId });
    logger.info({ projectId }, 'Firebase Admin initialized with project ID');
    return firebaseApp;
  }

  throw new FirebaseConfigError(
    'FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_JSON is not configured - cannot verify Firebase ID tokens'
  );
}

/**
 * Verify a Firebase ID token.
 * Falls back to test token decoding when running in test mode.
 */
async function verifyFirebaseIdToken(token) {
  if (!token) {
    throw new Error('No authentication token provided');
  }

  // Support local test mock tokens in test environment
  if (process.env.NODE_ENV === 'test' && token.startsWith('test-token:')) {
    const [, uid, email, role] = token.split(':');
    return {
      uid: uid || 'test-uid',
      email: email || 'test@example.com',
      name: 'Test User',
      picture: '',
      role: role || 'CITIZEN',
    };
  }

  if (token.split('.').length !== 3) {
    throw new Error('Malformed authentication token (expected a JWT)');
  }

  const app = initializeFirebase();

  try {
    return await getAuth(app).verifyIdToken(token);
  } catch (error) {
    logger.warn({ code: error.code, err: error.message }, 'Firebase ID token verification failed');
    throw error;
  }
}

/**
 * Firebase Cloud Messaging client, or null if Firebase is not configured.
 */
function getMessagingClient() {
  try {
    return getMessaging(initializeFirebase());
  } catch (err) {
    logger.debug({ err: err.message }, 'FCM unavailable');
    return null;
  }
}

module.exports = {
  initializeFirebase,
  verifyFirebaseIdToken,
  getMessagingClient,
  FirebaseConfigError,
};
