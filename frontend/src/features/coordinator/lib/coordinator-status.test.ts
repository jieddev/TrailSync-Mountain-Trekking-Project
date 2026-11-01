import { describe, expect, it } from 'vitest'

import {
  bookingTabFor,
  bookingTabs,
  coordinatorStatusLabel,
} from './coordinator-status'

describe('coordinator booking status', () => {
  it('names the next step for each pending booking', () => {
    expect(
      coordinatorStatusLabel({
        status: 'PENDING_CONFIRMATION',
        downpaymentStatus: 'PENDING_VERIFICATION',
      }).label,
    ).toBe('Receipt to review')
    expect(
      coordinatorStatusLabel({
        status: 'PENDING_CONFIRMATION',
        downpaymentStatus: 'VERIFIED',
      }).label,
    ).toBe('Reschedule to confirm')
    expect(
      coordinatorStatusLabel({
        status: 'PENDING_CONFIRMATION',
        downpaymentStatus: 'REJECTED',
      }).label,
    ).toBe('Waiting for new receipt')
  })

  it('puts each booking in the tab whose query lists it', () => {
    const cases = [
      ['PENDING_CONFIRMATION', 'PENDING_VERIFICATION', 'review'],
      ['PENDING_CONFIRMATION', 'VERIFIED', 'review'],
      ['PENDING_CONFIRMATION', 'REJECTED', 'hiker'],
      ['CONFIRMED', 'VERIFIED', 'upcoming'],
      ['COMPLETED', 'VERIFIED', 'completed'],
    ] as const
    for (const [status, downpaymentStatus, key] of cases) {
      const booking = { status, downpaymentStatus }
      expect(bookingTabFor(booking)).toBe(key)
      const tab = bookingTabs.find((candidate) => candidate.key === key)!
      expect(tab.query.status).toBe(status)
      if (tab.query.downpaymentStatus) {
        expect(tab.query.downpaymentStatus).toContain(downpaymentStatus)
      }
    }
  })

  it('leaves groups on the dispatch board out of the bookings tabs', () => {
    for (const status of [
      'CHECKED_IN',
      'GUIDE_ASSIGNED',
      'IN_PROGRESS',
    ] as const) {
      expect(
        bookingTabFor({ status, downpaymentStatus: 'VERIFIED' }),
      ).toBeNull()
    }
  })
})
