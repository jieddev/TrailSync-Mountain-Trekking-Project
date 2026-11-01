import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './api'
import { listLiveTreks } from './live-treks-api'

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify(body), { status }),
    )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('live treks API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists the treks in progress with the coordinator token', async () => {
    const trek = { bookingId: 'booking-1', latest: null, path: [] }
    const fetchMock = stubFetch({ items: [trek] })
    await expect(listLiveTreks('token')).resolves.toEqual([trek])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/coordinator/live-treks',
      { method: 'GET', headers: { Authorization: 'Bearer token' } },
    )
  })

  it('throws an ApiError with a safe message', async () => {
    stubFetch({ error: { code: 'FORBIDDEN' } }, 403)
    await expect(listLiveTreks('token')).rejects.toEqual(
      new ApiError('Could not load the live map.', 403, 'FORBIDDEN'),
    )
  })
})
