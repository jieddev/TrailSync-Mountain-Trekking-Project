import type { NextFunction, Request, Response } from 'express';

import { firebaseAuth } from '../lib/firebase-admin.js';

export type AuthenticatedRequest = Request & {
  authUser?: {
    email?: string;
    firebaseUid: string;
  };
};

function getBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) return undefined;

  const [scheme, token, ...extraParts] = authorizationHeader.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token || extraParts.length > 0) {
    return undefined;
  }

  return token;
}

export async function requireFirebaseAuth(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  const token = getBearerToken(request.get('authorization'));

  if (!token) {
    return response
      .status(401)
      .json({ message: 'A valid Firebase ID token is required.' });
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token);

    request.authUser = {
      email: decodedToken.email,
      firebaseUid: decodedToken.uid,
    };

    return next();
  } catch {
    return response
      .status(401)
      .json({ message: 'A valid Firebase ID token is required.' });
  }
}
