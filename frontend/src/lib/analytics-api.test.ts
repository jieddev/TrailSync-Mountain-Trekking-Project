import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './api'
import { getCoordinatorAnalytics } from './analytics-api'

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status })
}

describe('analytics API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads analytics for a date range', async () => {
    const analytics = { range: { from: '2026-10-01', to: '2026-10-20' } }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(analytics, 200))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getCoordinatorAnalytics('private-token', {
        from: '2026-10-01',
        to: '2026-10-20',
      }),
    ).resolves.toEqual(analytics)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/coordinator/analytics?from=2026-10-01&to=2026-10-20',
      { method: 'GET', headers: { Authorization: 'Bearer private-token' } },
    )
  })

  it('turns a failure into an ApiError with a safe message', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: 'VALIDATION_ERROR' } }, 400),
        ),
    )

    const error = await getCoordinatorAnalytics('private-token', {
      from: '2026-10-02',
      to: '2026-10-01',
    }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Could not load analytics.',
    })
  })
})
