import type { LiveTrek } from '../../../lib/live-treks-api'

// The guide app uploads about every 15 seconds; ask a little more often so a
// new fix shows up soon after it lands.
export const LIVE_MAP_POLL_MS = 10_000

// No fix for this long usually means the guide's phone has no signal.
export const STALE_AFTER_MS = 2 * 60_000

// Distinct path colours, readable on satellite imagery and apart from the
// green trail line.
const TREK_COLORS = [
  '#2563eb',
  '#db2777',
  '#0891b2',
  '#7c3aed',
  '#ca8a04',
  '#ea580c',
]

// A trek keeps its colour while others start and finish around it.
export function trekColor(bookingId: string) {
  let hash = 0
  for (const char of bookingId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return TREK_COLORS[hash % TREK_COLORS.length]
}

export function isStale(trek: LiveTrek, now: Date) {
  if (!trek.latest) return true
  return (
    now.valueOf() - new Date(trek.latest.recordedAt).valueOf() > STALE_AFTER_MS
  )
}

// "just now", "3 min ago", "1 h 5 min ago".
export function formatAgo(iso: string, now: Date) {
  const minutes = Math.floor((now.valueOf() - new Date(iso).valueOf()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min ago` : `${hours} h ago`
}
