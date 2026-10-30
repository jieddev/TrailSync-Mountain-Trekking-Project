import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import { listBookings, type Booking } from '../../../lib/bookings-api'
import StatusBadge from '../../booking/components/StatusBadge'
import { formatSchedule } from '../../booking/lib/booking-form'
import { bookingStatusLabel } from '../../booking/lib/booking-status'
import { pickNextTrek } from '../lib/next-trek'

type NextTrekState =
  | { status: 'loading' }
  | { status: 'loaded'; booking: Booking | null }
  | { status: 'error' }

const linkClass =
  'inline-flex rounded-lg text-sm font-bold text-[#007e4f] hover:text-[#006b43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]'

export default function NextTrekCard() {
  const { user } = useAuth()
  const [state, setState] = useState<NextTrekState>({ status: 'loading' })

  useEffect(() => {
    let isCurrent = true

    async function loadBookings() {
      try {
        const idToken = await user!.getIdToken()
        const bookings = await listBookings(idToken)
        if (isCurrent) {
          setState({ status: 'loaded', booking: pickNextTrek(bookings) })
        }
      } catch {
        if (isCurrent) setState({ status: 'error' })
      }
    }

    void loadBookings()
    return () => {
      isCurrent = false
    }
  }, [user])

  return (
    <section
      aria-labelledby="next-trek-title"
      className="rounded-2xl border border-[#d5e1da] bg-white p-6"
    >
      <h2 id="next-trek-title" className="text-sm font-bold text-[#173a2e]">
        Your next trek
      </h2>

      {state.status === 'loading' && (
        <p className="mt-4 text-sm text-[#52675e]" role="status">
          Loading your bookings…
        </p>
      )}
      {state.status === 'error' && (
        <>
          <p className="mt-4 text-sm leading-6 text-[#52675e]">
            We couldn’t load your bookings right now.
          </p>
          <Link className={`mt-3 ${linkClass}`} to="/bookings">
            Go to my bookings →
          </Link>
        </>
      )}
      {state.status === 'loaded' && state.booking === null && (
        <>
          <p className="mt-4 font-serif text-xl font-bold tracking-[-0.02em] text-[#002d20]">
            No upcoming treks yet
          </p>
          <p className="mt-1 text-sm leading-6 text-[#52675e]">
            Pick a trail and a date to plan your first climb.
          </p>
          <Link className={`mt-3 ${linkClass}`} to="/trails">
            Book a trek →
          </Link>
        </>
      )}
      {state.status === 'loaded' && state.booking !== null && (
        <NextTrekDetails booking={state.booking} />
      )}
    </section>
  )
}

function NextTrekDetails({ booking }: { booking: Booking }) {
  const status = bookingStatusLabel(booking)

  return (
    <>
      <p className="mt-4 font-serif text-2xl font-bold tracking-[-0.03em] text-[#002d20]">
        {booking.trail.name}
      </p>
      <p className="mt-1 text-sm text-[#173a2e]">
        {formatSchedule(booking.scheduledDate, booking.scheduledTime)}
      </p>
      <p className="mt-0.5 text-sm text-[#52675e]">
        {booking.participantCount}{' '}
        {booking.participantCount === 1 ? 'hiker' : 'hikers'}
        {booking.guide && ` · Guide: ${booking.guide.fullName}`}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ece8] pt-4">
        <StatusBadge label={status.label} tone={status.tone} />
        <Link className={linkClass} to={`/bookings/${booking.id}`}>
          View booking →
        </Link>
      </div>
    </>
  )
}
