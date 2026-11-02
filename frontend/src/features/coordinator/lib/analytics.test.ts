import { describe, expect, it } from 'vitest'

import type { CoordinatorAnalytics } from '../../../lib/analytics-api'
import {
  bookedValueRows,
  formatMinutes,
  formatPeso,
  monthLabel,
  presetRange,
  rangeProblem,
  trailColor,
  visitorRows,
} from './analytics'

describe('presetRange', () => {
  it.each([
    ['this-month', '2026-10-01'],
    ['last-3-months', '2026-08-01'],
    ['last-6-months', '2026-05-01'],
    ['this-year', '2026-01-01'],
  ] as const)('%s starts on %s and ends today', (preset, from) => {
    expect(presetRange(preset, '2026-10-20')).toEqual({
      from,
      to: '2026-10-20',
    })
  })

  it('crosses into the previous year', () => {
    expect(presetRange('last-6-months', '2026-02-10').from).toBe('2025-09-01')
  })
})

describe('rangeProblem', () => {
  it('accepts a year', () => {
    expect(rangeProblem({ from: '2026-01-01', to: '2026-12-31' })).toBeNull()
  })

  it('rejects missing, reversed, and too-long ranges', () => {
    expect(rangeProblem({ from: '', to: '2026-10-01' })).toMatch(/both/)
    expect(rangeProblem({ from: '2026-10-02', to: '2026-10-01' })).toMatch(
      /on or before/,
    )
    expect(rangeProblem({ from: '2025-01-01', to: '2026-10-01' })).toMatch(
      /one year/,
    )
  })
})

describe('formatting', () => {
  it('labels months and formats pesos and minutes', () => {
    expect(monthLabel('2026-10')).toBe('Oct 2026')
    expect(formatPeso(1780)).toBe('₱1,780')
    expect(formatMinutes(null)).toBe('—')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(120)).toBe('2 h')
    expect(formatMinutes(125)).toBe('2 h 5 min')
  })

  it('keeps trail colours by position and falls back to grey', () => {
    expect(trailColor(0)).toBe('#2a78d6')
    expect(trailColor(7)).toBe('#8a9a92')
  })
})

describe('chart rows', () => {
  const analytics = {
    visitors: {
      total: 3,
      walkIns: 0,
      byMonth: [{ month: '2026-09', byTrail: { a: 1, b: 2 } }],
    },
    bookedValue: {
      testMode: true,
      total: 550,
      byMonth: [{ month: '2026-09', amount: 550 }],
    },
  } as unknown as CoordinatorAnalytics

  it('flattens visitors and booked value per month', () => {
    expect(visitorRows(analytics)).toEqual([{ label: 'Sep 2026', a: 1, b: 2 }])
    expect(bookedValueRows(analytics)).toEqual([
      { label: 'Sep 2026', amount: 550 },
    ])
  })
})
