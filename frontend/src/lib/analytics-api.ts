import { requestJson } from './api'
import type { BookingStatus } from './bookings-api'

// GET /api/v1/coordinator/analytics (API_CONTRACT_V1.md §13). Dates are
// Asia/Manila calendar dates; months are "YYYY-MM".
export type CoordinatorAnalytics = {
  range: { from: string; to: string }
  months: string[]
  trails: {
    id: string
    name: string
    completedTreks: number
    visitors: number
    averageGroupSize: number | null
  }[]
  visitors: {
    total: number
    walkIns: number
    byMonth: { month: string; byTrail: Record<string, number> }[]
  }
  completedTreks: number
  bookingsByStatus: Partial<Record<BookingStatus, number>>
  guides: { id: string; fullName: string; completedTreks: number }[]
  safety: {
    incidents: number
    openIncidents: number
    medianMinutesToAcknowledge: number | null
    medianMinutesToResolve: number | null
    closureDaysByTrail: { trailId: string; name: string; days: number }[]
  }
  bookedValue: {
    testMode: boolean
    total: number
    byMonth: { month: string; amount: number }[]
  }
}

export function getCoordinatorAnalytics(
  idToken: string,
  range: { from: string; to: string },
) {
  const params = new URLSearchParams(range)
  return requestJson<CoordinatorAnalytics>(
    `/api/v1/coordinator/analytics?${params}`,
    { idToken },
    'Could not load analytics.',
  )
}
