import { describe, expect, it } from 'vitest'

import type { BookingStatus } from '../../../lib/bookings-api'
import {
  formatTrekTime,
  orderTodaySchedule,
  scheduleAction,
  todaysThunderstorm,
} from './today-schedule'

const booking = (id: string, status: BookingStatus, scheduledTime: string) => ({
  id,
  status,
  scheduledTime,
})

describe('today schedule', () => {
  it('lists groups by trek time with completed treks last', () => {
    const ordered = orderTodaySchedule([
      booking('done-early', 'COMPLETED', '06:00'),
      booking('late', 'CONFIRMED', '10:00'),
      booking('early', 'IN_PROGRESS', '07:00'),
      booking('done-late', 'COMPLETED', '09:00'),
      booking('mid', 'CHECKED_IN', '08:00'),
    ])
    expect(ordered.map((item) => item.id)).toEqual([
      'early',
      'mid',
      'late',
      'done-early',
      'done-late',
    ])
  })

  it('offers the next step for each stage', () => {
    expect(
      scheduleAction(booking('b1', 'PENDING_CONFIRMATION', '08:00')),
    ).toEqual({
      label: 'Review',
      to: '/coordinator/bookings/b1',
    })
    expect(scheduleAction(booking('b1', 'CONFIRMED', '08:00'))).toEqual({
      label: 'Check in',
      to: '/coordinator/bookings/b1/check-in',
    })
    expect(scheduleAction(booking('b1', 'CHECKED_IN', '08:00'))).toEqual({
      label: 'Assign guide',
      to: '/coordinator/dispatch',
    })
    for (const status of [
      'GUIDE_ASSIGNED',
      'IN_PROGRESS',
      'COMPLETED',
    ] as const) {
      expect(scheduleAction(booking('b1', status, '08:00'))).toEqual({
        label: 'View',
        to: '/coordinator/bookings/b1',
      })
    }
  })

  it('formats the trek time on a 12-hour clock', () => {
    expect(formatTrekTime('07:30')).toBe('7:30 AM')
    expect(formatTrekTime('13:00')).toBe('1:00 PM')
  })

  it('flags thunderstorms only when today’s forecast has one', () => {
    const day = (date: string, thunderstorm: boolean) => ({
      date,
      thunderstorm,
    })
    expect(todaysThunderstorm([day('2026-11-01', true)], '2026-11-01')).toBe(
      true,
    )
    expect(
      todaysThunderstorm(
        [day('2026-11-01', false), day('2026-11-02', true)],
        '2026-11-01',
      ),
    ).toBe(false)
    expect(todaysThunderstorm([], '2026-11-01')).toBe(false)
  })
})
