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

// The confirm endpoint returns the plain booking representation (no owner).
export function confirmBooking(idToken: string, bookingId: string) {
  return requestJson<Booking>(
    `/api/v1/bookings/${encodeURIComponent(bookingId)}/confirm`,
    { idToken, method: 'POST' },
    'Could not confirm this booking.',
  )
}
