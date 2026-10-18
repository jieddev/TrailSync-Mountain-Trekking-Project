import { describe, expect, it } from 'vitest'

import { bookingStatusLabel, downpaymentStatusLabel } from './booking-status'

describe('booking status labels', () => {
  it('describes a new booking request', () => {
    const booking = {
      status: 'PENDING_CONFIRMATION',
      downpaymentStatus: 'PENDING_VERIFICATION',
    } as const
    expect(bookingStatusLabel(booking).label).toBe('Awaiting confirmation')
    expect(downpaymentStatusLabel(booking).label).toBe(
      'Downpayment pending verification',
    )
  })

  it('describes a confirmed booking', () => {
    const booking = {
      status: 'CONFIRMED',
      downpaymentStatus: 'VERIFIED',
    } as const
    expect(bookingStatusLabel(booking).label).toBe('Confirmed')
    expect(downpaymentStatusLabel(booking).label).toBe('Downpayment verified')
  })

  it('describes a rescheduled booking that keeps its downpayment credit', () => {
    const booking = {
      status: 'PENDING_CONFIRMATION',
      downpaymentStatus: 'VERIFIED',
    } as const
    expect(bookingStatusLabel(booking).label).toBe(
      'Reschedule awaiting confirmation',
    )
    expect(downpaymentStatusLabel(booking).label).toBe(
      'Downpayment credit kept',
    )
  })
})
