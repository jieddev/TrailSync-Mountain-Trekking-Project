import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createBooking,
  getBooking,
  listBookings,
  rescheduleBooking,
  type CreateBookingInput,
} from './bookings-api'

const input: CreateBookingInput = {
  trailId: 'trl_sulfatara',
  scheduledDate: '2026-11-20',
  scheduledTime: '08:00',
  ownerDetails: { age: 28, address: 'Ormoc City, Leyte' },
  additionalParticipants: [
    { name: 'Maria Dela Cruz', age: 26, address: 'Ormoc City, Leyte' },
  ],
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status })
}

describe('bookings API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('creates a booking with the token and JSON body', async () => {
    const booking = { id: 'booking-1' }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(booking, 201))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createBooking('private-token', input)).resolves.toEqual(
      booking,
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/bookings',
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

  it('keeps validation details so the form can show them per field', async () => {
    const details = [
      {
        field: 'trailId',
        code: 'UNSUPPORTED_TRAIL',
        message: 'Select a supported trail.',
      },
    ]
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: 'VALIDATION_ERROR', message: 'x', details } },
            422,
          ),
        ),
    )

    await expect(createBooking('private-token', input)).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      details,
      message: 'Could not create your booking.',
    })
  })

  it('lists the caller bookings', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ items: [{ id: 'booking-1' }] }, 200))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listBookings('private-token')).resolves.toEqual([
      { id: 'booking-1' },
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/bookings',
      { method: 'GET', headers: { Authorization: 'Bearer private-token' } },
    )
  })

  it('reports a booking that is missing or owned by someone else', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: 'BOOKING_NOT_FOUND' } }, 404),
        ),
    )

    await expect(getBooking('private-token', 'b-1')).rejects.toMatchObject({
      status: 404,
      code: 'BOOKING_NOT_FOUND',
    })
  })

  it('reschedules with only the new date and time', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: 'booking-1' }, 200))
    vi.stubGlobal('fetch', fetchMock)

    await rescheduleBooking('private-token', 'booking-1', {
      scheduledDate: '2026-11-21',
      scheduledTime: '09:00',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/bookings/booking-1/reschedule',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          scheduledDate: '2026-11-21',
          scheduledTime: '09:00',
        }),
      }),
    )
  })
})
