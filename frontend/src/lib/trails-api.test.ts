import { afterEach, describe, expect, it, vi } from 'vitest'

import { getTrail, listTrails, type Trail } from './trails-api'

const sulfatara: Trail = {
  id: 'trl_sulfatara',
  slug: 'sulfatara',
  name: 'Sulfatara',
  description: null,
  package: {
    price: { amount: 550, currency: 'PHP' },
    maximumParticipants: 5,
    guideCount: 1,
  },
  paymentRequirement: { downpaymentPercent: 50, amount: 275, currency: 'PHP' },
}

describe('trails API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists the active trails from the public catalog', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [sulfatara] }), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listTrails()).resolves.toEqual([sulfatara])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/trails',
      { method: 'GET', headers: {} },
    )
  })

  it('keeps the not-found code for a missing trail with a safe message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: 'TRAIL_NOT_FOUND', message: 'internal message' },
          }),
          { status: 404 },
        ),
      ),
    )

    await expect(getTrail('trl_unknown')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'TRAIL_NOT_FOUND',
      message: 'Could not load this trail.',
    })
  })
})
