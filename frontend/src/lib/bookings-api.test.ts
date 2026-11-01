import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createBooking,
  getBooking,
  getReceiptImage,
  listBookings,
  rescheduleBooking,
  uploadPaymentReceipt,
  type CreateBookingInput,
} from './bookings-api'

const input: CreateBookingInput = {
  trailId: 'trl_sulfatara',
  scheduledDate: '2026-11-20',
  scheduledTime: '08:00',
  ownerDetails: { address: 'Ormoc City, Leyte' },
  additionalParticipants: [
    { name: 'Maria Dela Cruz', age: 26, address: 'Ormoc City, Leyte' },
  ],
  paymentOption: 'DOWNPAYMENT',
  acceptedWaiverVersion: '2026-11-01',
}

const receipt = new File([new Uint8Array([1, 2, 3])], 'receipt.png', {
  type: 'image/png',
})

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status })
}

describe('bookings API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('creates a booking as multipart: details as JSON plus the receipt', async () => {
    const booking = { id: 'booking-1' }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(booking, 201))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createBooking('private-token', input, {
        receipt,
        referenceNumber: ' 1234567890123 ',
      }),
    ).resolves.toEqual(booking)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:3000/api/v1/bookings')
    expect(init.method).toBe('POST')
    // The browser adds the multipart Content-Type with its boundary.
    expect(init.headers).toEqual({ Authorization: 'Bearer private-token' })
    const form = init.body as FormData
    expect(JSON.parse(form.get('booking') as string)).toEqual(input)
    expect((form.get('receipt') as File).name).toBe('receipt.png')
    expect(form.get('referenceNumber')).toBe('1234567890123')
  })

  it('omits a blank reference number', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 201))
    vi.stubGlobal('fetch', fetchMock)
    await createBooking('t', input, { receipt, referenceNumber: '  ' })
    expect(
      (fetchMock.mock.calls[0][1].body as FormData).has('referenceNumber'),
    ).toBe(false)
  })

  it('uploads a new receipt for a booking', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: 'b-1' }, 201))
    vi.stubGlobal('fetch', fetchMock)
    await uploadPaymentReceipt('t', 'b-1', { receipt })
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:3000/api/v1/bookings/b-1/payment-receipt',
    )
    expect(
      (fetchMock.mock.calls[0][1].body as FormData).get('receipt'),
    ).toBeInstanceOf(File)
  })

  it('reads a receipt image as a Blob with the token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(new Blob(['png'], { type: 'image/png' })))
    vi.stubGlobal('fetch', fetchMock)
    const blob = await getReceiptImage('t', 'b-1', 'r-1')
    expect(blob.type).toBe('image/png')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/bookings/b-1/payment-receipts/r-1/file',
      { headers: { Authorization: 'Bearer t' } },
    )
  })

  it('reports a missing receipt image', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: 'RECEIPT_NOT_FOUND' } }, 404),
        ),
    )
    await expect(getReceiptImage('t', 'b-1', 'r-1')).rejects.toMatchObject({
      status: 404,
      code: 'RECEIPT_NOT_FOUND',
    })
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

    await expect(
      createBooking('private-token', input, { receipt }),
    ).rejects.toMatchObject({
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
