const admin = require('firebase-admin');

let firebaseAuth;

const getFirebaseAuth = () => {
  if (firebaseAuth) return firebaseAuth;

  const requiredEnv = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
  ];

  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing Firebase Admin env vars: ${missing.join(', ')}`);
  }

  const app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });

  firebaseAuth = app.auth();
  return firebaseAuth;
};

module.exports = {
  verifyFirebaseToken: async (token, checkRevoked = true) => {
    const auth = getFirebaseAuth();
    return auth.verifyIdToken(token, checkRevoked);
  },
};
