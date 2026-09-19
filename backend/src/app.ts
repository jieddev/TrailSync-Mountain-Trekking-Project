import cors from 'cors';
import express from 'express';
// import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { prisma } from './lib/prisma.js';
import {
  type AuthenticatedRequest,
  requireFirebaseAuth,
} from './middleware/require-firebase-auth.js';

const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

export const app = express();

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

app.post('/users', requireFirebaseAuth, async (request, response) => {
  const { fullName } = request.body as Record<string, unknown>;
  const { authUser } = request as AuthenticatedRequest;

  if (typeof fullName !== 'string' || !fullName.trim()) {
    return response.status(400).json({
      message: 'fullName is required and must be a non-empty string.',
    });
  }

  if (!authUser?.email) {
    return response.status(400).json({
      message: 'The verified Firebase account must have an email address.',
    });
  }

  try {
    const user = await prisma.user.create({
      data: {
        firebaseUid: authUser.firebaseUid,
        fullName: fullName.trim(),
        email: authUser.email.trim().toLowerCase(),
      },
    });

    return response.status(201).json(user);
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return response.status(409).json({
        message: 'A user with this Firebase UID or email already exists.',
      });
    }

    return response.status(500).json({ message: 'Could not create user.' });
  }
});

function isPrismaUniqueConstraintError(error: unknown) {
  return (
    (error instanceof PrismaClientKnownRequestError ||
      (typeof error === 'object' && error !== null && 'code' in error)) &&
    (error as { code?: string }).code === 'P2002'
  );
}
