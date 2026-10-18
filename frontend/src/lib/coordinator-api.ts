import { requestJson } from './api'
import type { Booking, BookingStatus } from './bookings-api'

export type CoordinatorBooking = Booking & {
  owner: { id: string; fullName: string; email: string }
}

const coordinatorBookingsPath = '/api/v1/coordinator/bookings'

export async function listCoordinatorBookings(
  idToken: string,
  status?: BookingStatus,
) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  const { items } = await requestJson<{ items: CoordinatorBooking[] }>(
    `${coordinatorBookingsPath}${query}`,
    { idToken },
    'Could not load the booking queue.',
  )
  return items
}

export function getCoordinatorBooking(idToken: string, bookingId: string) {
  return requestJson<CoordinatorBooking>(
    `${coordinatorBookingsPath}/${encodeURIComponent(bookingId)}`,
    { idToken },
    'Could not load this booking.',
  )
}

export type GuideApplicationStatus = 'PENDING' | 'APPROVED' | 'DECLINED'

export type GuideApplication = {
  id: string
  fullName: string
  email: string
  status: GuideApplicationStatus
  declineReason: string | null
  reviewedAt: string | null
  reviewedBy: { id: string; fullName: string } | null
  createdAt: string
}

const guideApplicationsPath = '/api/v1/coordinator/guide-applications'

export async function listGuideApplications(
  idToken: string,
  status?: GuideApplicationStatus,
) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  const { items } = await requestJson<{ items: GuideApplication[] }>(
    `${guideApplicationsPath}${query}`,
    { idToken },
    'Could not load guide account requests.',
  )
  return items
}

// Approving creates the guide's TrailSync account.
export function approveGuideApplication(
  idToken: string,
  applicationId: string,
) {
  return requestJson<GuideApplication>(
    `${guideApplicationsPath}/${encodeURIComponent(applicationId)}/approve`,
    { idToken, method: 'POST' },
    'Could not approve this request.',
  )
}

export function declineGuideApplication(
  idToken: string,
  applicationId: string,
  reason?: string,
) {
  return requestJson<GuideApplication>(
    `${guideApplicationsPath}/${encodeURIComponent(applicationId)}/decline`,
    { idToken, method: 'POST', body: reason ? { reason } : {} },
    'Could not decline this request.',
  )
}

// The confirm endpoint returns the plain booking representation (no owner).
export function confirmBooking(idToken: string, bookingId: string) {
  return requestJson<Booking>(
    `/api/v1/bookings/${encodeURIComponent(bookingId)}/confirm`,
    { idToken, method: 'POST' },
    'Could not confirm this booking.',
  )
}
