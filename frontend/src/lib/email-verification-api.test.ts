import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  requestVerificationCode,
  verifyEmailCode,
} from './email-verification-api'

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status })

describe('requestVerificationCode', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts the email without a login token', async () => {
    const sent = {
      email: 'hiker@example.com',
      expiresAt: '2026-11-06T06:10:00.000Z',
      resendAvailableAt: '2026-11-06T06:01:00.000Z',
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(sent, 201))
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestVerificationCode('hiker@example.com')).resolves.toEqual(
      sent,
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/email-verifications',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'hiker@example.com' }),
      },
    )
  })

  it('keeps the error code for an existing account', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: 'ACCOUNT_EXISTS', message: 'x' } },
            409,
          ),
        ),
    )

    await expect(
      requestVerificationCode('hiker@example.com'),
    ).rejects.toMatchObject({ status: 409, code: 'ACCOUNT_EXISTS' })
  })
})

describe('verifyEmailCode', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts the email and code', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ email: 'hiker@example.com', verified: true }, 200),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      verifyEmailCode('hiker@example.com', '123456'),
    ).resolves.toEqual({ email: 'hiker@example.com', verified: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/email-verifications/verify',
      expect.objectContaining({
        body: JSON.stringify({ email: 'hiker@example.com', code: '123456' }),
      }),
    )
  })

  it('keeps the error code for an expired code', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: 'CODE_EXPIRED', message: 'x' } }, 410),
        ),
    )

    await expect(
      verifyEmailCode('hiker@example.com', '123456'),
    ).rejects.toMatchObject({ status: 410, code: 'CODE_EXPIRED' })
  })
})
