import { describe, expect, it } from 'vitest'

import type { LiveTrek } from '../../../lib/live-treks-api'
import { formatAgo, isStale, trekColor } from './live-map'

const now = new Date('2026-11-01T02:00:00Z')

const trek = (recordedAt: string | null): LiveTrek => ({
  bookingId: 'booking-1',
  trail: { id: 'trl_sulfatara', slug: 'sulfatara', name: 'Sulfatara' },
  guide: { id: 'g-1', fullName: 'Juan' },
  trekStartedAt: '2026-11-01T01:00:00Z',
  participantCount: 4,
  latest: recordedAt
    ? { latitude: 11, longitude: 124.7, accuracyM: 5, recordedAt }
    : null,
  path: [],
})

describe('live map helpers', () => {
  it('flags a trek as stale without a recent fix', () => {
    expect(isStale(trek('2026-11-01T01:59:00Z'), now)).toBe(false)
    expect(isStale(trek('2026-11-01T01:57:00Z'), now)).toBe(true)
    expect(isStale(trek(null), now)).toBe(true)
  })

  it('formats how long ago a fix was taken', () => {
    expect(formatAgo('2026-11-01T01:59:30Z', now)).toBe('just now')
    expect(formatAgo('2026-11-01T01:57:00Z', now)).toBe('3 min ago')
    expect(formatAgo('2026-11-01T01:00:00Z', now)).toBe('1 h ago')
    expect(formatAgo('2026-11-01T00:55:00Z', now)).toBe('1 h 5 min ago')
  })

  it('gives each trek a stable colour', () => {
    expect(trekColor('booking-1')).toBe(trekColor('booking-1'))
    expect(trekColor('booking-1')).toMatch(/^#[0-9a-f]{6}$/)
  })
})
