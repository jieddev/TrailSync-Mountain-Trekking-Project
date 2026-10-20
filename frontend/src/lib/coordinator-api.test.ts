import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './api'
import {
  approveGuideApplication,
  assignNextGuide,
  checkInBooking,
  completeTrek,
  confirmBooking,
  declineGuideApplication,
  getCoordinatorBooking,
  listCoordinatorBookings,
  listGuideApplications,
  listGuides,
  setGuideAvailability,
} from './coordinator-api'

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status })
}

describe('coordinator API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists the queue filtered by status', async () => {
    const items = [{ id: 'booking-1' }]
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items }, 200))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      listCoordinatorBookings('private-token', 'PENDING_CONFIRMATION'),
    ).resolves.toEqual(items)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/coordinator/bookings?status=PENDING_CONFIRMATION',
      { method: 'GET', headers: { Authorization: 'Bearer private-token' } },
    )
  })

  it('lists every booking when no status is given', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ items: [] }, 200))
    vi.stubGlobal('fetch', fetchMock)

    await listCoordinatorBookings('private-token')
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:3000/api/v1/coordinator/bookings',
    )
  })

  it('loads one booking with an encoded id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: 'a/b' }, 200))
    vi.stubGlobal('fetch', fetchMock)

    await getCoordinatorBooking('private-token', 'a/b')
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:3000/api/v1/coordinator/bookings/a%2Fb',
    )
  })

  it('confirms a booking without a request body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: 'CONFIRMED' }, 200))
    vi.stubGlobal('fetch', fetchMock)

    await confirmBooking('private-token', 'booking-1')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/bookings/booking-1/confirm',
      { method: 'POST', headers: { Authorization: 'Bearer private-token' } },
    )
  })

  it('exposes the conflict code when a booking was already confirmed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'BOOKING_NOT_CONFIRMABLE',
              message: 'Booking cannot be confirmed in its current state.',
            },
          },
          409,
        ),
      ),
    )

    const error = await confirmBooking('private-token', 'booking-1').catch(
      (caught: unknown) => caught,
    )
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 409,
      code: 'BOOKING_NOT_CONFIRMABLE',
      message: 'Could not confirm this booking.',
    })
  })

  it('lists guide account requests filtered by status', async () => {
    const items = [{ id: 'application-1' }]
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items }, 200))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      listGuideApplications('private-token', 'PENDING'),
    ).resolves.toEqual(items)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/coordinator/guide-applications?status=PENDING',
      { method: 'GET', headers: { Authorization: 'Bearer private-token' } },
    )
  })

  it('approves a guide request without a request body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: 'APPROVED' }, 200))
    vi.stubGlobal('fetch', fetchMock)

    await approveGuideApplication('private-token', 'a/b')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/coordinator/guide-applications/a%2Fb/approve',
      { method: 'POST', headers: { Authorization: 'Bearer private-token' } },
    )
  })

  it('declines a guide request with an optional reason', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => jsonResponse({ status: 'DECLINED' }, 200))
    vi.stubGlobal('fetch', fetchMock)

    await declineGuideApplication('private-token', 'application-1', 'No ID')
    await declineGuideApplication('private-token', 'application-1')
    expect(fetchMock.mock.calls.map(([, init]) => init.body)).toEqual([
      JSON.stringify({ reason: 'No ID' }),
      JSON.stringify({}),
    ])
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:3000/api/v1/coordinator/guide-applications/application-1/decline',
    )
  })

  it("lists today's bookings for a status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ items: [] }, 200))
    vi.stubGlobal('fetch', fetchMock)

    await listCoordinatorBookings('private-token', 'CONFIRMED', { today: true })
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:3000/api/v1/coordinator/bookings?status=CONFIRMED&today=true',
    )
  })

  it('checks a group in with attendance and walk-ins', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: 'GUIDE_ASSIGNED' }, 200))
    vi.stubGlobal('fetch', fetchMock)
    const input = {
      attendance: [{ participantId: 'p-1', present: true }],
      walkIns: [{ name: 'Walk In', age: 30, address: 'Ormoc' }],
    }

    await expect(
      checkInBooking('private-token', 'a/b', input),
    ).resolves.toEqual({ status: 'GUIDE_ASSIGNED' })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/coordinator/bookings/a%2Fb/check-in',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer private-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      },
    )
  })

  it('assigns the next guide and completes a trek without a request body', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => jsonResponse({ id: 'booking-1' }, 200))
    vi.stubGlobal('fetch', fetchMock)

    await assignNextGuide('private-token', 'booking-1')
    await completeTrek('private-token', 'booking-1')
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init])).toEqual([
      [
        'http://localhost:3000/api/v1/coordinator/bookings/booking-1/assign-guide',
        { method: 'POST', headers: { Authorization: 'Bearer private-token' } },
      ],
      [
        'http://localhost:3000/api/v1/coordinator/bookings/booking-1/complete',
        { method: 'POST', headers: { Authorization: 'Bearer private-token' } },
      ],
    ])
  })

  it('surfaces dispatch refusals by code', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: 'NO_GUIDE_AVAILABLE', message: 'server text' } },
            409,
          ),
        ),
    )

    await expect(assignNextGuide('private-token', 'booking-1')).rejects.toEqual(
      new ApiError('Could not assign a guide.', 409, 'NO_GUIDE_AVAILABLE'),
    )
  })

  it('lists guides and changes a guide’s availability', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'guide-1' }] }, 200))
      .mockResolvedValueOnce(jsonResponse({ id: 'guide-1' }, 200))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listGuides('private-token')).resolves.toEqual([
      { id: 'guide-1' },
    ])
    await setGuideAvailability('private-token', 'guide-1', 'OFF_DUTY')
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:3000/api/v1/coordinator/guides',
    )
    expect(fetchMock.mock.calls[1]).toEqual([
      'http://localhost:3000/api/v1/coordinator/guides/guide-1/availability',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer private-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'OFF_DUTY' }),
      },
    ])
  })
})
