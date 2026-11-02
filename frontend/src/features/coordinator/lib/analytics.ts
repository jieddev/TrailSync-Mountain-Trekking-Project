import type { CoordinatorAnalytics } from '../../../lib/analytics-api'
import type { BookingStatus } from '../../../lib/bookings-api'

export type DateRange = { from: string; to: string }
export type RangePreset =
  'this-month' | 'last-3-months' | 'last-6-months' | 'this-year'

export const rangePresets: { id: RangePreset; label: string }[] = [
  { id: 'this-month', label: 'This month' },
  { id: 'last-3-months', label: 'Last 3 months' },
  { id: 'last-6-months', label: 'Last 6 months' },
  { id: 'this-year', label: 'This year' },
]

// The server accepts at most this many days.
export const MAX_RANGE_DAYS = 366

const firstOfMonth = (year: number, monthIndex: number) => {
  const date = new Date(Date.UTC(year, monthIndex, 1))
  return date.toISOString().slice(0, 10)
}

// Ranges end today (an Asia/Manila "YYYY-MM-DD"), like the server's default.
export function presetRange(preset: RangePreset, today: string): DateRange {
  const [year, month] = today.split('-').map(Number)
  const monthsBack = {
    'this-month': 0,
    'last-3-months': 2,
    'last-6-months': 5,
    'this-year': month - 1,
  }[preset]
  return { from: firstOfMonth(year, month - 1 - monthsBack), to: today }
}

// Returns why the range can't be used, or null when it is fine.
export function rangeProblem({ from, to }: DateRange): string | null {
  if (!from || !to) return 'Choose both a start and an end date.'
  if (from > to) return 'The start date must be on or before the end date.'
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1
  if (days > MAX_RANGE_DAYS) return 'Choose a range of one year or less.'
  return null
}

const monthFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

// "2026-10" → "Oct 2026".
export function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return monthFormat.format(new Date(Date.UTC(year, monthNumber - 1, 1)))
}

export function formatPeso(amount: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount)
}

// "45 min", "2 h 5 min", or "—" when there is no data.
export function formatMinutes(minutes: number | null) {
  if (minutes === null) return '—'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

// Categorical colours for trails, in a fixed order that passed the dataviz
// colour-blind checks. A trail keeps its colour by its position in the
// server's (stable, by-name) list, never by rank.
export const trailColors = ['#2a78d6', '#eb6834', '#1baf7a']
export const singleSeriesColor = '#477a69'

export function trailColor(index: number) {
  return trailColors[index] ?? '#8a9a92'
}

// One row per month for the stacked visitors chart: { label, [trailId]: n }.
export function visitorRows(analytics: CoordinatorAnalytics) {
  return analytics.visitors.byMonth.map(({ month, byTrail }) => ({
    label: monthLabel(month),
    ...byTrail,
  }))
}

export function bookedValueRows(analytics: CoordinatorAnalytics) {
  return analytics.bookedValue.byMonth.map(({ month, amount }) => ({
    label: monthLabel(month),
    amount,
  }))
}

export const bookingStatusOrder: { status: BookingStatus; label: string }[] = [
  { status: 'PENDING_CONFIRMATION', label: 'Awaiting confirmation' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'CHECKED_IN', label: 'Checked in, waiting for guide' },
  { status: 'GUIDE_ASSIGNED', label: 'Guide assigned' },
  { status: 'IN_PROGRESS', label: 'On the trail' },
  { status: 'COMPLETED', label: 'Completed' },
]
