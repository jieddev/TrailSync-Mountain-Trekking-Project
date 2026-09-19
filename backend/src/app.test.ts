import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./lib/firebase-admin.js', () => ({
  firebaseAuth: {
    verifyIdToken: vi.fn(),
  },
}));

vi.mock('./lib/prisma.js', () => ({
  prisma: {
    user: {
      create: vi.fn(),
    },
  },
}));

import { app } from './app.js';
import { firebaseAuth } from './lib/firebase-admin.js';
import { prisma } from './lib/prisma.js';

const verifyIdToken = vi.mocked(firebaseAuth.verifyIdToken);
const createUser = vi.mocked(prisma.user.create);

describe('POST /users', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates a HIKER profile from verified token claims', async () => {
    verifyIdToken.mockResolvedValue({
      email: 'Hiker@Example.com',
      uid: 'firebase-hiker-uid',
    } as never);
    createUser.mockResolvedValue({
      createdAt: new Date('2026-09-19T00:00:00.000Z'),
      email: 'hiker@example.com',
      firebaseUid: 'firebase-hiker-uid',
      fullName: 'Trail Hiker',
      id: 'user-id',
      role: 'HIKER',
      updatedAt: new Date('2026-09-19T00:00:00.000Z'),
    } as never);

    const response = await request(app)
      .post('/users')
      .set('Authorization', 'Bearer valid-token')
      .send({
        email: 'attacker@example.com',
        firebaseUid: 'attacker-uid',
        fullName: ' Trail Hiker ',
        role: 'COORDINATOR',
      });

    expect(response.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith({
      data: {
        email: 'hiker@example.com',
        firebaseUid: 'firebase-hiker-uid',
        fullName: 'Trail Hiker',
      },
    });
    expect(response.body).toMatchObject({
      email: 'hiker@example.com',
      firebaseUid: 'firebase-hiker-uid',
      role: 'HIKER',
    });
  });

  it('rejects a request without a bearer token', async () => {
    const response = await request(app)
      .post('/users')
      .send({ fullName: 'Trail Hiker' });

    expect(response.status).toBe(401);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects an invalid bearer token', async () => {
    verifyIdToken.mockRejectedValue(new Error('Invalid token'));

    const response = await request(app)
      .post('/users')
      .set('Authorization', 'Bearer invalid-token')
      .send({ fullName: 'Trail Hiker' });

    expect(response.status).toBe(401);
  });

  it('rejects a token without an email claim', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'firebase-hiker-uid' } as never);

    const response = await request(app)
      .post('/users')
      .set('Authorization', 'Bearer valid-token')
      .send({ fullName: 'Trail Hiker' });

    expect(response.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('rejects a missing profile name', async () => {
    verifyIdToken.mockResolvedValue({
      email: 'hiker@example.com',
      uid: 'firebase-hiker-uid',
    } as never);

    const response = await request(app)
      .post('/users')
      .set('Authorization', 'Bearer valid-token')
      .send({ fullName: '   ' });

    expect(response.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('returns a conflict for a duplicate profile', async () => {
    verifyIdToken.mockResolvedValue({
      email: 'hiker@example.com',
      uid: 'firebase-hiker-uid',
    } as never);
    createUser.mockRejectedValue({ code: 'P2002' } as never);

    const response = await request(app)
      .post('/users')
      .set('Authorization', 'Bearer valid-token')
      .send({ fullName: 'Trail Hiker' });

    expect(response.status).toBe(409);
  });
});
