import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, getCurrentUserProfile } from './users-api'

describe('getCurrentUserProfile', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests the authenticated profile and returns the backend fields', async () => {
    const profile = {
      id: 'profile-1',
      fullName: 'Mark Jasper',
      email: 'mark@example.com',
      role: 'HIKER',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getCurrentUserProfile('private-token')).resolves.toEqual(
      profile,
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/users/me',
      { headers: { Authorization: 'Bearer private-token' } },
    )
  })

  it('preserves the missing-profile code without exposing backend text', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              error: { code: 'PROFILE_NOT_FOUND', message: 'internal message' },
            }),
            { status: 404 },
          ),
        ),
    )

    await expect(getCurrentUserProfile('private-token')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'PROFILE_NOT_FOUND',
      message: 'Could not load your TrailSync profile.',
    })
  })

  it('turns general API failures into a safe error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { message: 'secret database detail' } }),
            { status: 500 },
          ),
        ),
    )

    const request = getCurrentUserProfile('private-token')
    await expect(request).rejects.toBeInstanceOf(ApiError)
    await expect(request).rejects.toMatchObject({
      status: 500,
      message: 'Could not load your TrailSync profile.',
    })
  })
})
