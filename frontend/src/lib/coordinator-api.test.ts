import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './api'
import {
  confirmBooking,
  getCoordinatorBooking,
  listCoordinatorBookings,
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
})
