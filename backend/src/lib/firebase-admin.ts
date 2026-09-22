import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getFirebaseCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    return cert({
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      projectId,
    });
  }

  return applicationDefault();
}

const firebaseApp =
  getApps()[0] ??
  initializeApp({
    credential: getFirebaseCredential(),
  });

export const firebaseAuth = getAuth(firebaseApp);
