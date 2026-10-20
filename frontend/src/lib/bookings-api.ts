import { requestJson } from './api'
import type { PaymentRequirement, TrailPackage } from './trails-api'

export type BookingStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'GUIDE_ASSIGNED'
  | 'COMPLETED'
export type DownpaymentStatus = 'PENDING_VERIFICATION' | 'VERIFIED'

export type BookingParticipant = {
  id: string
  kind: 'BOOKING_OWNER' | 'ADDITIONAL_PARTICIPANT' | 'WALK_IN'
  name: string
  age: number
  address: string
  // Recorded at check-in; null before the group checks in.
  attendance: 'PRESENT' | 'ABSENT' | null
}

export type Booking = {
  id: string
  trail: { id: string; name: string }
  scheduledDate: string
  scheduledTime: string
  status: BookingStatus
  downpaymentStatus: DownpaymentStatus
  participants: BookingParticipant[]
  participantCount: number
  guide: { id: string; fullName: string } | null
  checkedInAt: string | null
  guideAssignedAt: string | null
  completedAt: string | null
  package: TrailPackage
  paymentRequirement: PaymentRequirement
  createdAt: string
  updatedAt: string
}

export type ParticipantInput = { name: string; age: number; address: string }

export type CreateBookingInput = {
  trailId: string
  scheduledDate: string
  scheduledTime: string
  ownerDetails: { age: number; address: string }
  additionalParticipants: ParticipantInput[]
}

export type ScheduleInput = { scheduledDate: string; scheduledTime: string }

const bookingPath = (bookingId: string) =>
  `/api/v1/bookings/${encodeURIComponent(bookingId)}`

export function createBooking(idToken: string, input: CreateBookingInput) {
  return requestJson<Booking>(
    '/api/v1/bookings',
    { idToken, method: 'POST', body: input },
    'Could not create your booking.',
  )
}

export async function listBookings(idToken: string) {
  const { items } = await requestJson<{ items: Booking[] }>(
    '/api/v1/bookings',
    { idToken },
    'Could not load your bookings.',
  )
  return items
}

export function getBooking(idToken: string, bookingId: string) {
  return requestJson<Booking>(
    bookingPath(bookingId),
    { idToken },
    'Could not load this booking.',
  )
}

export function rescheduleBooking(
  idToken: string,
  bookingId: string,
  schedule: ScheduleInput,
) {
  return requestJson<Booking>(
    `${bookingPath(bookingId)}/reschedule`,
    { idToken, method: 'POST', body: schedule },
    'Could not reschedule your booking.',
  )
}
