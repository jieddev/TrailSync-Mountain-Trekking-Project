import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  closureOn,
  createTrailRestriction,
  liftTrailRestriction,
  listTrailClosures,
  listTrailRestrictions,
  type TrailClosure,
} from './trail-restrictions-api'

const closure: TrailClosure = {
  id: 'restriction-1',
  startDate: '2026-10-20',
  endDate: '2026-10-21',
  reason: 'Heavy rain advisory',
  status: 'ACTIVE',
}

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('trail restrictions API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists a trail’s closures without a token', async () => {
    const fetchMock = stubFetch({ items: [closure] })
    await expect(listTrailClosures('trl_sulfatara')).resolves.toEqual([closure])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/trails/trl_sulfatara/restrictions',
      { method: 'GET', headers: {} },
    )
  })

  it('lists, creates and lifts restrictions as the coordinator', async () => {
    const fetchMock = stubFetch({ items: [] })
    await listTrailRestrictions('token')
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:3000/api/v1/coordinator/trail-restrictions',
      { method: 'GET', headers: { Authorization: 'Bearer token' } },
    )

    const input = {
      trailId: 'trl_sulfatara',
      startDate: '2026-10-20',
      endDate: '2026-10-21',
      reason: 'Heavy rain advisory',
    }
    stubFetch({})
    await createTrailRestriction('token', input)
    expect(fetch).toHaveBeenLastCalledWith(
      'http://localhost:3000/api/v1/coordinator/trail-restrictions',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      },
    )

    stubFetch({})
    await liftTrailRestriction('token', 'restriction/1')
    expect(fetch).toHaveBeenLastCalledWith(
      'http://localhost:3000/api/v1/coordinator/trail-restrictions/restriction%2F1/lift',
      { method: 'POST', headers: { Authorization: 'Bearer token' } },
    )
  })

  it('keeps the refusal code when a restriction was already lifted', async () => {
    stubFetch({ error: { code: 'RESTRICTION_ALREADY_LIFTED' } }, 409)
    await expect(
      liftTrailRestriction('token', 'restriction-1'),
    ).rejects.toMatchObject({
      status: 409,
      code: 'RESTRICTION_ALREADY_LIFTED',
      message: 'Could not lift this restriction.',
    })
  })

  it('finds the closure covering a date, inclusive of both ends', () => {
    expect(closureOn([closure], '2026-10-19')).toBeNull()
    expect(closureOn([closure], '2026-10-20')).toBe(closure)
    expect(closureOn([closure], '2026-10-21')).toBe(closure)
    expect(closureOn([closure], '2026-10-22')).toBeNull()
  })
})
