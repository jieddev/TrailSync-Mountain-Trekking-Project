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

  it('describes check-in, dispatch, and completion', () => {
    const at = (
      status: 'CHECKED_IN' | 'GUIDE_ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED',
    ) => ({ status, downpaymentStatus: 'VERIFIED' }) as const
    expect(bookingStatusLabel(at('CHECKED_IN'))).toEqual({
      label: 'Checked in · waiting for guide',
      tone: 'pending',
    })
    expect(bookingStatusLabel(at('GUIDE_ASSIGNED')).label).toBe(
      'Guide assigned',
    )
    expect(bookingStatusLabel(at('IN_PROGRESS')).label).toBe('On the trail')
    expect(bookingStatusLabel(at('COMPLETED')).label).toBe('Completed')
    for (const status of [
      'CHECKED_IN',
      'GUIDE_ASSIGNED',
      'IN_PROGRESS',
      'COMPLETED',
    ] as const) {
      expect(downpaymentStatusLabel(at(status)).label).toBe(
        'Downpayment verified',
      )
    }
  })
})
