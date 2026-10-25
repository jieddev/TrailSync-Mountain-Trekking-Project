import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import { ApiError } from '../../../lib/api'
import { getBooking, type Booking } from '../../../lib/bookings-api'
import PageHeader from '../components/PageHeader'
import RescheduleForm from '../components/RescheduleForm'
import StatusBadge from '../components/StatusBadge'
import StatusCard from '../components/StatusCard'
import { formatMoney, formatSchedule } from '../lib/booking-form'
import {
  bookingStatusLabel,
  downpaymentStatusLabel,
} from '../lib/booking-status'
import type { BookingCreatedState } from './BookingFormPage'

type BookingState =
  | { status: 'loading' }
  | { status: 'loaded'; booking: Booking }
  | { status: 'not-found' }
  | { status: 'error' }

const backLinkClass =
  'text-sm font-bold text-[#007e4f] underline-offset-4 hover:underline'

export default function BookingDetailPage() {
  const { user } = useAuth()
  const { bookingId } = useParams()
  const location = useLocation()
  const [state, setState] = useState<BookingState>({ status: 'loading' })
  const [successMessage, setSuccessMessage] = useState(
    (location.state as BookingCreatedState | null)?.successMessage ?? '',
  )

  useEffect(() => {
    let isCurrent = true

    async function loadBooking() {
      setState({ status: 'loading' })
      try {
        const idToken = await user!.getIdToken()
        const booking = await getBooking(idToken, bookingId!)
        if (isCurrent) setState({ status: 'loaded', booking })
      } catch (error) {
        if (!isCurrent) return
        setState({
          status:
            error instanceof ApiError && error.code === 'BOOKING_NOT_FOUND'
              ? 'not-found'
              : 'error',
        })
      }
    }

    void loadBooking()
    return () => {
      isCurrent = false
    }
  }, [user, bookingId])

  function handleRescheduled(booking: Booking) {
    setState({ status: 'loaded', booking })
    setSuccessMessage(
      'Your new schedule was sent. A tourism coordinator will review it.',
    )
  }

  if (state.status === 'loading') {
    return <StatusCard role="status">Loading booking…</StatusCard>
  }
  if (state.status === 'not-found' || state.status === 'error') {
    return (
      <StatusCard
        title={
          state.status === 'not-found'
            ? 'Booking not found'
            : 'Booking couldn’t load'
        }
      >
        <p>
          {state.status === 'not-found'
            ? 'We couldn’t find this booking in your account.'
            : 'We couldn’t load this booking. Please try again later.'}
        </p>
        <Link className={`mt-4 inline-flex ${backLinkClass}`} to="/bookings">
          Back to my bookings
        </Link>
      </StatusCard>
    )
  }

  const { booking } = state
  const status = bookingStatusLabel(booking)
  const downpayment = downpaymentStatusLabel(booking)

  return (
    <>
      <Link className={backLinkClass} to="/bookings">
        ← My bookings
      </Link>
      <div className="mt-4">
        <PageHeader eyebrow="Booking" title={booking.trail.name}>
          {formatSchedule(booking.scheduledDate, booking.scheduledTime)}
        </PageHeader>
      </div>

      {successMessage && (
        <p
          className="mb-6 rounded-xl border border-[#b9d8c8] bg-[#eef7f1] px-4 py-3 text-sm font-semibold text-[#006b43]"
          role="status"
        >
          {successMessage}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="grid gap-6">
          <section
            aria-labelledby="status-title"
            className="rounded-2xl border border-[#d5e1da] bg-white p-6"
          >
            <h2 id="status-title" className="text-sm font-bold text-[#173a2e]">
              Status
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge label={status.label} tone={status.tone} />
              <StatusBadge label={downpayment.label} tone={downpayment.tone} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[#52675e]">
              {hikerStatusMessage(booking)}
            </p>
          </section>

          <section
            aria-labelledby="participants-title"
            className="rounded-2xl border border-[#d5e1da] bg-white p-6"
          >
            <h2
              id="participants-title"
              className="text-sm font-bold text-[#173a2e]"
            >
              Participants ({booking.participantCount} of{' '}
              {booking.package.maximumParticipants})
            </h2>
            <ul className="mt-3 divide-y divide-[#e7ece8]">
              {booking.participants.map((person) => (
                <li
                  className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:justify-between"
                  key={person.id}
                >
                  <span className="font-semibold text-[#173a2e]">
                    {person.name}
                    {person.kind === 'BOOKING_OWNER' && (
                      <span className="ml-2 rounded-full bg-[#e8f1eb] px-2 py-0.5 text-xs font-bold text-[#006b43]">
                        You
                      </span>
                    )}
                  </span>
                  <span className="text-[#52675e]">
                    Age {person.age} · {person.address}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {booking.status === 'CONFIRMED' && (
            <RescheduleForm
              booking={booking}
              key={booking.updatedAt}
              onRescheduled={handleRescheduled}
            />
          )}
        </div>

        <aside className="rounded-2xl border border-[#d5e1da] bg-white p-6">
          <h2 className="text-sm font-bold text-[#173a2e]">Package</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[#70857b]">Package price</dt>
              <dd className="font-semibold text-[#173a2e]">
                {formatMoney(booking.package.price)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#70857b]">
                Downpayment ({booking.paymentRequirement.downpaymentPercent}%)
              </dt>
              <dd className="font-bold text-[#006b43]">
                {formatMoney(booking.paymentRequirement)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#70857b]">Guides</dt>
              <dd className="font-semibold text-[#173a2e]">
                {booking.package.guideCount}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-[#70857b]">
            Prices are fixed when you book.
          </p>
        </aside>
      </div>
    </>
  )
}

function hikerStatusMessage(booking: Booking) {
  switch (booking.status) {
    case 'CONFIRMED':
      return 'Your trek is confirmed. Check in at the tourism office on your trek day; your guide is assigned at check-in.'
    case 'CHECKED_IN':
      return 'You’re checked in. Your guide will be assigned as soon as one is available.'
    case 'GUIDE_ASSIGNED':
      return `You’re checked in and ${booking.guide?.fullName ?? 'your guide'} is leading your group. Enjoy the trek!`
    case 'IN_PROGRESS':
      return `Your group is on the trail with ${booking.guide?.fullName ?? 'your guide'}. Enjoy the trek!`
    case 'COMPLETED':
      return 'Your trek is complete. Thank you for trekking with us!'
    default:
      return 'A tourism coordinator will review your booking and verify the downpayment.'
  }
}
