import type { Booking, BookingPayment } from '../../../lib/bookings-api'

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
  if (booking.downpaymentStatus === 'REJECTED') {
    return { label: 'Payment needs attention', tone: 'declined' }
  }
  return booking.downpaymentStatus === 'VERIFIED'
    ? { label: 'Reschedule awaiting confirmation', tone: 'pending' }
    : { label: 'Awaiting confirmation', tone: 'pending' }
}

type PaymentStatusInput = Pick<Booking, 'status' | 'downpaymentStatus'> & {
  payment?: Pick<BookingPayment, 'option'>
}

// The GCash payment: the downpayment, or the full price when paid in full.
export function downpaymentStatusLabel(
  booking: PaymentStatusInput,
): StatusLabel {
  const paid =
    booking.payment?.option === 'FULL' ? 'Full payment' : 'Downpayment'
  switch (booking.downpaymentStatus) {
    case 'PENDING_VERIFICATION':
      return { label: 'Receipt under review', tone: 'pending' }
    case 'REJECTED':
      return { label: 'Receipt rejected · upload a new one', tone: 'declined' }
  }
  return booking.status === 'PENDING_CONFIRMATION'
    ? { label: `${paid} credit kept`, tone: 'success' }
    : { label: `${paid} verified`, tone: 'success' }
}

// The cash balance owed at check-in on a 50% booking, or null when none is owed.
export function balanceStatusLabel(
  booking: Pick<Booking, 'payment'>,
): StatusLabel | null {
  if (booking.payment.balanceDueOnSite <= 0) return null
  return booking.payment.balanceCollectedAt
    ? { label: 'Balance paid at check-in', tone: 'success' }
    : { label: 'Balance due at check-in', tone: 'pending' }
}
