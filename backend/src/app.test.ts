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
      findUnique: vi.fn(),
    },
  },
}));

import { app } from './app.js';
import { CURRENT_TERMS_VERSION } from './lib/agreements.js';
import { firebaseAuth } from './lib/firebase-admin.js';
import { prisma } from './lib/prisma.js';

const verifyIdToken = vi.mocked(firebaseAuth.verifyIdToken);
const createUser = vi.mocked(prisma.user.create);
const findUniqueUser = vi.mocked(prisma.user.findUnique);

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
        age: 28,
        role: 'COORDINATOR',
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
      });

    expect(response.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith({
      data: {
        email: 'hiker@example.com',
        firebaseUid: 'firebase-hiker-uid',
        fullName: 'Trail Hiker',
        age: 28,
        termsAcceptedAt: expect.any(Date),
        termsVersion: CURRENT_TERMS_VERSION,
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

  it.each([
    ['missing', undefined],
    ['not a whole number', 28.5],
    ['given as text', '28'],
    ['under 18', 17],
  ])('rejects a profile whose age is %s', async (_label, age) => {
    verifyIdToken.mockResolvedValue({
      email: 'hiker@example.com',
      uid: 'firebase-hiker-uid',
    } as never);

    const response = await request(app)
      .post('/users')
      .set('Authorization', 'Bearer valid-token')
      .send({ fullName: 'Trail Hiker', age, acceptedTermsVersion: CURRENT_TERMS_VERSION });

    expect(response.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['outdated', '2000-01-01'],
  ])('rejects a profile whose terms acceptance is %s', async (_label, acceptedTermsVersion) => {
    verifyIdToken.mockResolvedValue({
      email: 'hiker@example.com',
      uid: 'firebase-hiker-uid',
    } as never);

    const response = await request(app)
      .post('/users')
      .set('Authorization', 'Bearer valid-token')
      .send({ fullName: 'Trail Hiker', age: 28, acceptedTermsVersion });

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
      .send({
        fullName: 'Trail Hiker',
        age: 28,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
      });

    expect(response.status).toBe(409);
  });
});

describe('GET /users/me', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns the profile belonging to the authenticated Firebase user', async () => {
    verifyIdToken.mockResolvedValue({
      email: 'hiker@example.com',
      uid: 'firebase-hiker-uid',
    } as never);
    findUniqueUser.mockResolvedValue({
      email: 'hiker@example.com',
      fullName: 'Trail Hiker',
      age: 28,
      id: 'user-id',
      role: 'HIKER',
    } as never);

    const response = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer valid-token')
      .send({
        firebaseUid: 'attacker-uid',
        role: 'COORDINATOR',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      email: 'hiker@example.com',
      fullName: 'Trail Hiker',
      age: 28,
      id: 'user-id',
      role: 'HIKER',
    });
    expect(findUniqueUser).toHaveBeenCalledWith({
      where: { firebaseUid: 'firebase-hiker-uid' },
      select: {
        id: true,
        fullName: true,
        email: true,
        age: true,
        role: true,
      },
    });
  });

  it('rejects a request without a bearer token', async () => {
    const response = await request(app).get('/users/me');

    expect(response.status).toBe(401);
    expect(findUniqueUser).not.toHaveBeenCalled();
  });

  it('rejects an invalid bearer token', async () => {
    verifyIdToken.mockRejectedValue(new Error('Invalid token'));

    const response = await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(findUniqueUser).not.toHaveBeenCalled();
  });

  it('returns not found when the authenticated user has no profile', async () => {
    verifyIdToken.mockResolvedValue({
      email: 'hiker@example.com',
      uid: 'firebase-hiker-uid',
    } as never);
    findUniqueUser.mockResolvedValue(null);

    const response = await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: 'PROFILE_NOT_FOUND',
      message: 'User profile was not found.',
    });
  });

  it('does not expose database errors', async () => {
    verifyIdToken.mockResolvedValue({
      email: 'hiker@example.com',
      uid: 'firebase-hiker-uid',
    } as never);
    findUniqueUser.mockRejectedValue(new Error('secret database details'));

    const response = await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not retrieve user profile.',
      },
      requestId: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toContain('secret database details');
  });
});
