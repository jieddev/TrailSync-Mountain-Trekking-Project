import type { Booking } from '../../../lib/bookings-api'
import type { StatusTone } from '../../booking/lib/booking-status'
import type { CoordinatorSummary } from '../../../lib/coordinator-api'

type StatusLabel = { label: string; tone: StatusTone }

// Coordinator wording: says what the coordinator does next. The hiker wording
// stays in features/booking/lib/booking-status.ts.
export function coordinatorStatusLabel(
  booking: Pick<Booking, 'status' | 'downpaymentStatus'>,
): StatusLabel {
  switch (booking.status) {
    case 'CONFIRMED':
      return { label: 'Confirmed', tone: 'success' }
    case 'CHECKED_IN':
      return { label: 'Waiting for a guide', tone: 'pending' }
    case 'GUIDE_ASSIGNED':
      return { label: 'Guide assigned · not started', tone: 'success' }
    case 'IN_PROGRESS':
      return { label: 'On the trail', tone: 'success' }
    case 'COMPLETED':
      return { label: 'Completed', tone: 'success' }
  }
  switch (booking.downpaymentStatus) {
    case 'REJECTED':
      return { label: 'Waiting for new receipt', tone: 'declined' }
    case 'VERIFIED':
      return { label: 'Reschedule to confirm', tone: 'pending' }
    default:
      return { label: 'Receipt to review', tone: 'pending' }
  }
}

export type BookingTabKey = 'review' | 'hiker' | 'upcoming' | 'completed'

export type BookingTab = {
  key: BookingTabKey
  label: string
  intro: string
  empty: string
  query: Pick<Booking, 'status'> & {
    downpaymentStatus?: Booking['downpaymentStatus'][]
  }
  count: (summary: CoordinatorSummary) => number
}

// Grouped by what the coordinator does next. Today's arrivals, groups waiting
// for a guide, and groups on the trail are handled on Check-in & dispatch.
export const bookingTabs: BookingTab[] = [
  {
    key: 'review',
    label: 'Needs review',
    intro:
      'Check the GCash receipt, then confirm the trek or reject the receipt. Rescheduled bookings also need confirming. Soonest treks first.',
    empty: 'No bookings are waiting for review.',
    query: {
      status: 'PENDING_CONFIRMATION',
      downpaymentStatus: ['PENDING_VERIFICATION', 'VERIFIED'],
    },
    count: (summary) => summary.bookings.needsReview,
  },
  {
    key: 'hiker',
    label: 'Waiting on hiker',
    intro:
      'You rejected the receipt. Nothing to do until the hiker uploads a new one, then the booking moves to Needs review.',
    empty: 'No bookings are waiting on a hiker.',
    query: { status: 'PENDING_CONFIRMATION', downpaymentStatus: ['REJECTED'] },
    count: (summary) => summary.bookings.waitingOnHiker,
  },
  {
    key: 'upcoming',
    label: 'Upcoming',
    intro:
      'Confirmed treks, soonest first. Check groups in on their scheduled day from Check-in & dispatch.',
    empty: 'No confirmed treks yet.',
    query: { status: 'CONFIRMED' },
    count: (summary) => summary.bookings.upcoming,
  },
  {
    key: 'completed',
    label: 'Completed',
    intro: 'Finished treks. Certificates are emailed when a trek is completed.',
    empty: 'No completed treks yet.',
    query: { status: 'COMPLETED' },
    count: (summary) => summary.bookings.completed,
  },
]

// The bookings tab a booking belongs to, or null while it is on the dispatch
// board (checked in, guide assigned, or on the trail).
export function bookingTabFor(
  booking: Pick<Booking, 'status' | 'downpaymentStatus'>,
): BookingTabKey | null {
  switch (booking.status) {
    case 'PENDING_CONFIRMATION':
      return booking.downpaymentStatus === 'REJECTED' ? 'hiker' : 'review'
    case 'CONFIRMED':
      return 'upcoming'
    case 'COMPLETED':
      return 'completed'
    default:
      return null
  }
}

// Payment column wording for coordinators.
export function coordinatorPaymentLabel(
  booking: Pick<Booking, 'downpaymentStatus'>,
): StatusLabel {
  switch (booking.downpaymentStatus) {
    case 'PENDING_VERIFICATION':
      return { label: 'Receipt submitted', tone: 'pending' }
    case 'REJECTED':
      return { label: 'Receipt rejected', tone: 'declined' }
    default:
      return { label: 'Verified', tone: 'success' }
  }
}
