import type { Booking } from '../../../lib/bookings-api'

export type StatusTone = 'pending' | 'success' | 'declined'

type StatusLabel = { label: string; tone: StatusTone }

// Hiker-facing wording for the booking lifecycle in API_CONTRACT_V1.md §4.
export function bookingStatusLabel(
  booking: Pick<Booking, 'status' | 'downpaymentStatus'>,
): StatusLabel {
  if (booking.status === 'CONFIRMED') {
    return { label: 'Confirmed', tone: 'success' }
  }
  return booking.downpaymentStatus === 'VERIFIED'
    ? { label: 'Reschedule awaiting confirmation', tone: 'pending' }
    : { label: 'Awaiting confirmation', tone: 'pending' }
}

export function downpaymentStatusLabel(
  booking: Pick<Booking, 'status' | 'downpaymentStatus'>,
): StatusLabel {
  if (booking.downpaymentStatus === 'PENDING_VERIFICATION') {
    return { label: 'Downpayment pending verification', tone: 'pending' }
  }
  return booking.status === 'CONFIRMED'
    ? { label: 'Downpayment verified', tone: 'success' }
    : { label: 'Downpayment credit kept', tone: 'success' }
}
