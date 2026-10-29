import { describe, expect, it } from 'vitest'

import type { BookingStatus } from '../../../lib/bookings-api'
import { pickNextTrek } from './next-trek'

function trek(
  id: string,
  status: BookingStatus,
  scheduledDate: string,
  scheduledTime = '07:00',
) {
  return { id, status, scheduledDate, scheduledTime }
}

describe('pickNextTrek', () => {
  it('returns null without bookings', () => {
    expect(pickNextTrek([])).toBeNull()
  })

  it('ignores completed treks', () => {
    expect(pickNextTrek([trek('a', 'COMPLETED', '2026-11-01')])).toBeNull()
  })

  it('picks the earliest scheduled trek', () => {
    const next = pickNextTrek([
      trek('later', 'CONFIRMED', '2026-11-10'),
      trek('sooner-late', 'PENDING_CONFIRMATION', '2026-11-05', '09:00'),
      trek('sooner-early', 'CONFIRMED', '2026-11-05', '06:30'),
    ])
    expect(next?.id).toBe('sooner-early')
  })

  it('prefers a trek on the trail right now', () => {
    const next = pickNextTrek([
      trek('earlier', 'CONFIRMED', '2026-10-30'),
      trek('on-trail', 'IN_PROGRESS', '2026-10-31'),
    ])
    expect(next?.id).toBe('on-trail')
  })
})
