import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import { listBookings, type Booking } from '../../../lib/bookings-api'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import StatusCard from '../components/StatusCard'
import { formatSchedule } from '../lib/booking-form'
import { bookingStatusLabel } from '../lib/booking-status'

type BookingsState =
  | { status: 'loading' }
  | { status: 'loaded'; bookings: Booking[] }
  | { status: 'error' }

const primaryLinkClass =
  'inline-flex rounded-lg bg-[#477a69] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#3a6457] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] focus-visible:ring-offset-2'

export default function MyBookingsPage() {
  const { user } = useAuth()
  const [state, setState] = useState<BookingsState>({ status: 'loading' })

  useEffect(() => {
    let isCurrent = true

    async function loadBookings() {
      try {
        const idToken = await user!.getIdToken()
        const bookings = await listBookings(idToken)
        if (isCurrent) setState({ status: 'loaded', bookings })
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
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader eyebrow="Bookings" title="My bookings" />
        <Link className={`mb-6 ${primaryLinkClass}`} to="/trails">
          Book a trek
        </Link>
      </div>

      {state.status === 'loading' && (
        <StatusCard role="status">Loading your bookings…</StatusCard>
      )}
      {state.status === 'error' && (
        <StatusCard title="Bookings couldn’t load">
          We couldn’t load your bookings. Please try again later.
        </StatusCard>
      )}
      {state.status === 'loaded' && state.bookings.length === 0 && (
        <StatusCard title="No bookings yet">
          When you book a trek, it will appear here with its status.
        </StatusCard>
      )}
      {state.status === 'loaded' && state.bookings.length > 0 && (
        <ul className="grid gap-3">
          {state.bookings.map((booking) => {
            const status = bookingStatusLabel(booking)
            return (
              <li key={booking.id}>
                <Link
                  className="flex flex-col gap-3 rounded-2xl border border-[#d5e1da] bg-white p-5 transition hover:border-[#9fc2b2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] sm:flex-row sm:items-center sm:justify-between"
                  to={`/bookings/${booking.id}`}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-[#173a2e]">
                      {booking.trail.name}
                    </p>
                    <p className="mt-1 text-sm text-[#52675e]">
                      {formatSchedule(
                        booking.scheduledDate,
                        booking.scheduledTime,
                      )}{' '}
                      · {booking.participantCount}{' '}
                      {booking.participantCount === 1 ? 'person' : 'people'}
                    </p>
                  </div>
                  <StatusBadge label={status.label} tone={status.tone} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
