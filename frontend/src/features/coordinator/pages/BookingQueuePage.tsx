import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import type { BookingStatus } from '../../../lib/bookings-api'
import {
  listCoordinatorBookings,
  type CoordinatorBooking,
} from '../../../lib/coordinator-api'
import PageHeader from '../../booking/components/PageHeader'
import StatusBadge from '../../booking/components/StatusBadge'
import StatusCard from '../../booking/components/StatusCard'
import { formatMoney, formatSchedule } from '../../booking/lib/booking-form'
import {
  bookingStatusLabel,
  downpaymentStatusLabel,
} from '../../booking/lib/booking-status'

const tabs: { status: BookingStatus; label: string; empty: string }[] = [
  {
    status: 'PENDING_CONFIRMATION',
    label: 'Pending review',
    empty: 'No bookings are waiting for review.',
  },
  {
    status: 'CONFIRMED',
    label: 'Confirmed',
    empty: 'No confirmed bookings yet.',
  },
]

type QueueState =
  | { status: 'loading' }
  | { status: 'loaded'; bookings: CoordinatorBooking[] }
  | { status: 'error' }

const reviewLinkClass =
  'inline-flex rounded-lg border border-[#d5e1da] bg-white px-3 py-1.5 text-sm font-bold text-[#007e4f] hover:bg-[#f3f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]'

export default function BookingQueuePage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab =
    tabs.find((tab) => tab.status === searchParams.get('status')) ?? tabs[0]
  const [state, setState] = useState<QueueState>({ status: 'loading' })

  useEffect(() => {
    let isCurrent = true

    async function loadQueue() {
      setState({ status: 'loading' })
      try {
        const idToken = await user!.getIdToken()
        const bookings = await listCoordinatorBookings(
          idToken,
          activeTab.status,
        )
        if (isCurrent) setState({ status: 'loaded', bookings })
      } catch {
        if (isCurrent) setState({ status: 'error' })
      }
    }

    void loadQueue()
    return () => {
      isCurrent = false
    }
  }, [user, activeTab.status])

  return (
    <>
      <PageHeader eyebrow="Coordinator" title="Booking queue">
        Review new and rescheduled bookings, verify the downpayment, and confirm
        the trek. Soonest treks are listed first.
      </PageHeader>

      <div
        aria-label="Booking status"
        className="mb-5 inline-flex rounded-xl border border-[#d5e1da] bg-white p-1"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            aria-selected={tab.status === activeTab.status}
            className={`rounded-lg px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] ${tab.status === activeTab.status ? 'bg-[#002d20] text-white' : 'text-[#52675e] hover:bg-[#f3f6f2]'}`}
            key={tab.status}
            onClick={() => setSearchParams({ status: tab.status })}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {state.status === 'loading' && (
        <StatusCard role="status">Loading bookings…</StatusCard>
      )}
      {state.status === 'error' && (
        <StatusCard title="Booking queue couldn’t load">
          We couldn’t load the booking queue. Please try again later.
        </StatusCard>
      )}
      {state.status === 'loaded' && state.bookings.length === 0 && (
        <StatusCard title="Nothing here">{activeTab.empty}</StatusCard>
      )}
      {state.status === 'loaded' && state.bookings.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-[#d5e1da] bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#e7ece8] bg-[#f7f9f6] text-xs font-bold uppercase tracking-[0.08em] text-[#70857b]">
                <tr>
                  <th className="px-4 py-3" scope="col">
                    Trek
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Booked by
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Group
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Downpayment
                  </th>
                  <th className="px-4 py-3" scope="col">
                    Status
                  </th>
                  <th className="px-4 py-3" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7ece8]">
                {state.bookings.map((booking) => (
                  <QueueRow booking={booking} key={booking.id} />
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-3 md:hidden">
            {state.bookings.map((booking) => (
              <QueueCard booking={booking} key={booking.id} />
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function QueueRow({ booking }: { booking: CoordinatorBooking }) {
  const status = bookingStatusLabel(booking)
  const downpayment = downpaymentStatusLabel(booking)
  return (
    <tr className="align-top">
      <td className="px-4 py-4">
        <p className="font-bold text-[#173a2e]">{booking.trail.name}</p>
        <p className="mt-1 text-[#52675e]">
          {formatSchedule(booking.scheduledDate, booking.scheduledTime)}
        </p>
      </td>
      <td className="px-4 py-4">
        <p className="font-semibold text-[#173a2e]">{booking.owner.fullName}</p>
        <p className="mt-1 text-[#70857b]">{booking.owner.email}</p>
      </td>
      <td className="px-4 py-4 text-[#173a2e]">
        {booking.participantCount} of {booking.package.maximumParticipants}
      </td>
      <td className="px-4 py-4">
        <p className="font-semibold text-[#173a2e]">
          {formatMoney(booking.paymentRequirement)}
        </p>
        <p className="mt-1 text-xs text-[#70857b]">{downpayment.label}</p>
      </td>
      <td className="px-4 py-4">
        <StatusBadge label={status.label} tone={status.tone} />
      </td>
      <td className="px-4 py-4 text-right">
        <Link
          className={reviewLinkClass}
          to={`/coordinator/bookings/${booking.id}`}
        >
          {booking.status === 'CONFIRMED' ? 'View' : 'Review'}
        </Link>
      </td>
    </tr>
  )
}

function QueueCard({ booking }: { booking: CoordinatorBooking }) {
  const status = bookingStatusLabel(booking)
  return (
    <li>
      <Link
        className="block rounded-2xl border border-[#d5e1da] bg-white p-5 hover:border-[#9fc2b2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]"
        to={`/coordinator/bookings/${booking.id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-bold text-[#173a2e]">{booking.trail.name}</p>
          <StatusBadge label={status.label} tone={status.tone} />
        </div>
        <p className="mt-1 text-sm text-[#52675e]">
          {formatSchedule(booking.scheduledDate, booking.scheduledTime)}
        </p>
        <p className="mt-3 text-sm text-[#173a2e]">
          {booking.owner.fullName} · {booking.participantCount}{' '}
          {booking.participantCount === 1 ? 'person' : 'people'} ·{' '}
          {formatMoney(booking.paymentRequirement)} downpayment
        </p>
      </Link>
    </li>
  )
}
