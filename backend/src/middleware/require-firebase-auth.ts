import type { NextFunction, Request, Response } from 'express';

import { firebaseAuth } from '../lib/firebase-admin.js';
import { logger } from '../lib/logger.js';

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
  const log = (request as Request & { log?: typeof logger }).log ?? logger;
  const authorizationHeader = request.get('authorization');
  const token = getBearerToken(authorizationHeader);

  if (!token) {
    log.warn(
      {
        authorizationHeaderPresent: Boolean(authorizationHeader),
        authorizationHeaderValid: false,
      },
      'Firebase authentication rejected because the bearer token was missing or malformed',
    );

    return response.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' },
      requestId: (request as Request & { id?: string }).id,
    });
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token);

    request.authUser = {
      email: decodedToken.email,
      firebaseUid: decodedToken.uid,
    };

    return next();
  } catch (error) {
    log.warn(
      { err: error },
      'Firebase authentication rejected because ID token verification failed',
    );

    return response.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication is invalid.' },
      requestId: (request as Request & { id?: string }).id,
    });
  }
}
