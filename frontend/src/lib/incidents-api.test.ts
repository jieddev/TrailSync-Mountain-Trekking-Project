import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  acknowledgeIncident,
  listIncidents,
  mapsUrl,
  resolveIncident,
} from './incidents-api'

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify(body), { status }),
    )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const base = 'http://localhost:3000/api/v1/coordinator/incidents'

describe('incidents API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists incidents, optionally by status', async () => {
    const fetchMock = stubFetch({ items: [] })
    await expect(listIncidents('token')).resolves.toEqual([])
    await listIncidents('token', 'OPEN')
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      base,
      `${base}?status=OPEN`,
    ])
    expect(fetchMock.mock.calls[0][1]).toEqual({
      method: 'GET',
      headers: { Authorization: 'Bearer token' },
    })
  })

  it('acknowledges and resolves an incident', async () => {
    const fetchMock = stubFetch({ id: 'incident-1' })
    await acknowledgeIncident('token', 'incident-1')
    await resolveIncident('token', 'incident-1', 'Group walked down safely')
    expect(fetchMock.mock.calls).toEqual([
      [
        `${base}/incident-1/acknowledge`,
        { method: 'POST', headers: { Authorization: 'Bearer token' } },
      ],
      [
        `${base}/incident-1/resolve`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ note: 'Group walked down safely' }),
        },
      ],
    ])
  })

  it('reports refusals with their code', async () => {
    stubFetch({ error: { code: 'INCIDENT_ALREADY_RESOLVED' } }, 409)
    await expect(
      acknowledgeIncident('token', 'incident-1'),
    ).rejects.toMatchObject({ status: 409, code: 'INCIDENT_ALREADY_RESOLVED' })
  })

  it('links a location to Google Maps', () => {
    expect(
      mapsUrl({
        latitude: 11.0812,
        longitude: 124.7301,
        accuracyM: 12,
        recordedAt: null,
      }),
    ).toBe('https://www.google.com/maps/search/?api=1&query=11.0812,124.7301')
  })
})
