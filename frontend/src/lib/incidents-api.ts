import { requestJson } from './api'
import type { BookingStatus } from './bookings-api'

// OPEN when a guide sends an SOS, ACKNOWLEDGED once a coordinator has seen it,
// RESOLVED with a note on how it ended. The booking's status never changes.
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'

export type IncidentLocation = {
  latitude: number
  longitude: number
  accuracyM: number | null
  recordedAt: string | null
}

export type Incident = {
  id: string
  status: IncidentStatus
  booking: {
    id: string
    status: BookingStatus
    scheduledDate: string
    scheduledTime: string
    trail: { id: string; name: string }
    owner: { fullName: string }
    participantCount: number
  }
  guide: { id: string; fullName: string }
  location: IncidentLocation | null
  note: string | null
  createdAt: string
  acknowledgedAt: string | null
  acknowledgedBy: { id: string; fullName: string } | null
  resolvedAt: string | null
  resolvedBy: { id: string; fullName: string } | null
  resolutionNote: string | null
}

const incidentsPath = '/api/v1/coordinator/incidents'

// Unresolved incidents first, newest first within each status.
export async function listIncidents(idToken: string, status?: IncidentStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  const { items } = await requestJson<{ items: Incident[] }>(
    `${incidentsPath}${query}`,
    { idToken },
    'Could not load incidents.',
  )
  return items
}

export function acknowledgeIncident(idToken: string, incidentId: string) {
  return requestJson<Incident>(
    `${incidentsPath}/${encodeURIComponent(incidentId)}/acknowledge`,
    { idToken, method: 'POST' },
    'Could not acknowledge this incident.',
  )
}

export function resolveIncident(
  idToken: string,
  incidentId: string,
  note: string,
) {
  return requestJson<Incident>(
    `${incidentsPath}/${encodeURIComponent(incidentId)}/resolve`,
    { idToken, method: 'POST', body: { note } },
    'Could not resolve this incident.',
  )
}

export function mapsUrl({ latitude, longitude }: IncidentLocation) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}
