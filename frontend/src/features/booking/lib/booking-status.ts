import type { Booking } from '../../../lib/bookings-api'

export type StatusTone = 'pending' | 'success' | 'declined'

type StatusLabel = { label: string; tone: StatusTone }

// Hiker-facing wording for the booking lifecycle in API_CONTRACT_V1.md §4.
export function bookingStatusLabel(
  booking: Pick<Booking, 'status' | 'downpaymentStatus'>,
): StatusLabel {
  switch (booking.status) {
    case 'CONFIRMED':
      return { label: 'Confirmed', tone: 'success' }
    case 'CHECKED_IN':
      return { label: 'Checked in · waiting for guide', tone: 'pending' }
    case 'GUIDE_ASSIGNED':
      return { label: 'Guide assigned', tone: 'success' }
    case 'IN_PROGRESS':
      return { label: 'On the trail', tone: 'success' }
    case 'COMPLETED':
      return { label: 'Completed', tone: 'success' }
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
  return booking.status === 'PENDING_CONFIRMATION'
    ? { label: 'Downpayment credit kept', tone: 'success' }
    : { label: 'Downpayment verified', tone: 'success' }
}
