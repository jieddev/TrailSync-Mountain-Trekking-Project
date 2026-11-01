import { Link } from 'react-router-dom'

import type { CoordinatorBooking } from '../../../lib/coordinator-api'
import { TrailClosedTag } from '../../booking/components/BookingRestrictionNotice'
import StatusBadge from '../../booking/components/StatusBadge'
import { coordinatorStatusLabel } from '../lib/coordinator-status'
import {
  formatTrekTime,
  orderTodaySchedule,
  scheduleAction,
} from '../lib/today-schedule'
import { cardClass, linkButtonClass } from '../lib/ui'

export type ScheduleState =
  | { status: 'loading' }
  | { status: 'loaded'; bookings: CoordinatorBooking[] }
  | { status: 'error' }

// Every group booked for today, with the next step for each.
export default function TodaySchedule({ state }: { state: ScheduleState }) {
  return (
    <section aria-labelledby="schedule-title" className={cardClass}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-[#173a2e]" id="schedule-title">
          Today’s schedule
        </h2>
        <Link
          className="text-sm font-bold text-[#007e4f] underline-offset-4 hover:underline"
          to="/coordinator/dispatch"
        >
          Check-in &amp; dispatch
        </Link>
      </div>

      {state.status === 'loading' && (
        <p className="mt-4 text-sm text-[#52675e]" role="status">
          Loading today’s groups…
        </p>
      )}
      {state.status === 'error' && (
        <p className="mt-4 text-sm text-[#52675e]">
          We couldn’t load today’s groups. Please try again later.
        </p>
      )}
      {state.status === 'loaded' && state.bookings.length === 0 && (
        <p className="mt-4 text-sm text-[#52675e]">
          No treks are booked for today.
        </p>
      )}
      {state.status === 'loaded' && state.bookings.length > 0 && (
        <ul className="mt-3 divide-y divide-[#e7ece8]">
          {orderTodaySchedule(state.bookings).map((booking) => {
            const status = coordinatorStatusLabel(booking)
            const action = scheduleAction(booking)
            const done = booking.status === 'COMPLETED'
            return (
              <li
                className={`flex flex-col gap-3 py-4 text-sm sm:flex-row sm:items-center ${done ? 'opacity-60' : ''}`}
                key={booking.id}
              >
                <p className="w-20 shrink-0 font-bold text-[#173a2e]">
                  {formatTrekTime(booking.scheduledTime)}
                </p>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#173a2e]">
                    {booking.trail.name}
                  </p>
                  <p className="mt-0.5 text-[#52675e]">
                    {booking.owner.fullName} · {booking.participantCount}{' '}
                    {booking.participantCount === 1 ? 'person' : 'people'}
                  </p>
                  <TrailClosedTag booking={booking} />
                </div>
                <div className="flex items-center gap-3 sm:justify-end">
                  <StatusBadge label={status.label} tone={status.tone} />
                  <Link
                    aria-label={`${action.label}: ${booking.trail.name} at ${formatTrekTime(booking.scheduledTime)}, ${booking.owner.fullName}`}
                    className={linkButtonClass}
                    to={action.to}
                  >
                    {action.label}
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
