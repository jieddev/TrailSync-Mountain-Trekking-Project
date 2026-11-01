import { requestJson } from './api'

// A GPS fix the guide's app uploaded during the trek.
export type LiveLocation = {
  latitude: number
  longitude: number
  accuracyM: number | null
  recordedAt: string
}

// A trek in progress with the guide's latest fix and the path walked so far
// (API_CONTRACT_V1.md §11).
export type LiveTrek = {
  bookingId: string
  trail: { id: string; slug: string; name: string }
  guide: { id: string; fullName: string } | null
  trekStartedAt: string | null
  participantCount: number
  // Null until the guide's app sends its first fix.
  latest: LiveLocation | null
  // In time order, thinned to at most 500 points, ending at `latest`.
  path: Omit<LiveLocation, 'accuracyM'>[]
}

export async function listLiveTreks(idToken: string) {
  const { items } = await requestJson<{ items: LiveTrek[] }>(
    '/api/v1/coordinator/live-treks',
    { idToken },
    'Could not load the live map.',
  )
  return items
}
