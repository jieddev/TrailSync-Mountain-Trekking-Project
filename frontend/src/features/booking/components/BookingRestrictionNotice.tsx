import type { Booking } from '../../../lib/bookings-api'
import { formatDateRange } from '../lib/booking-form'
import Alert from './Alert'

type BookingRestrictionNoticeProps = {
  booking: Booking
  audience: 'hiker' | 'coordinator'
}

// Shown while the coordinator has closed the booking's trail on its date.
export default function BookingRestrictionNotice({
  booking,
  audience,
}: BookingRestrictionNoticeProps) {
  const restriction = booking.trailRestriction
  if (!restriction || booking.status === 'COMPLETED') return null
  const dates = formatDateRange(restriction.startDate, restriction.endDate)
  return (
    <Alert
      className="mb-6"
      title={`${booking.trail.name} is closed ${dates}`}
      tone="danger"
    >
      <p>Reason: {restriction.reason}</p>
      <p className="mt-1">
        {audience === 'hiker'
          ? 'Your booking is kept. Reschedule to another date, or contact the tourism office.'
          : 'Check-in, guide dispatch and trek start are refused until the restriction is lifted or ends.'}
      </p>
    </Alert>
  )
}

// A compact tag for booking lists.
export function TrailClosedTag({ booking }: { booking: Booking }) {
  if (!booking.trailRestriction || booking.status === 'COMPLETED') return null
  return (
    <span className="mt-1 inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
      Trail closed
    </span>
  )
}
