import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import {
  listCoordinatorBookings,
  type CoordinatorBooking,
} from '../../../lib/coordinator-api'
import { TrailClosedTag } from '../../booking/components/BookingRestrictionNotice'
import PageHeader from '../../booking/components/PageHeader'
import StatusBadge from '../../booking/components/StatusBadge'
import StatusCard from '../../booking/components/StatusCard'
import { formatMoney, formatSchedule } from '../../booking/lib/booking-form'
import { useCoordinatorSummary } from '../lib/coordinator-summary'
import {
  bookingTabs,
  coordinatorPaymentLabel,
  coordinatorStatusLabel,
} from '../lib/coordinator-status'

type QueueState =
  | { status: 'loading' }
  | { status: 'loaded'; bookings: CoordinatorBooking[] }
  | { status: 'error' }

const reviewLinkClass =
  'inline-flex rounded-lg border border-[#d5e1da] bg-white px-3 py-1.5 text-sm font-bold text-[#007e4f] hover:bg-[#f3f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]'

export default function BookingQueuePage() {
  const { user } = useAuth()
  const { summary } = useCoordinatorSummary()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab =
    bookingTabs.find((tab) => tab.key === searchParams.get('tab')) ??
    bookingTabs[0]
  const [state, setState] = useState<QueueState>({ status: 'loading' })

  useEffect(() => {
    let isCurrent = true

    async function loadQueue() {
      setState({ status: 'loading' })
      try {
        const idToken = await user!.getIdToken()
        const bookings = await listCoordinatorBookings(
          idToken,
          activeTab.query.status,
          { downpaymentStatus: activeTab.query.downpaymentStatus },
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
  }, [user, activeTab])

  return (
    <>
      <PageHeader eyebrow="Coordinator" title="Bookings">
        Review payments and confirm treks before the hike day.
      </PageHeader>

      <p className="mb-5 rounded-xl border border-[#d5e1da] bg-white px-4 py-3 text-sm text-[#52675e]">
        Today’s arrivals, groups waiting for a guide, and groups on the trail
        are on{' '}
        <Link
          className="font-bold text-[#007e4f] underline-offset-4 hover:underline"
          to="/coordinator/dispatch"
        >
          Check-in &amp; dispatch
        </Link>
        .
      </p>

      <div
        aria-label="Booking lists"
        className="mb-3 flex max-w-full overflow-x-auto rounded-xl border border-[#d5e1da] bg-white p-1 sm:inline-flex"
        role="tablist"
      >
        {bookingTabs.map((tab) => {
          const selected = tab.key === activeTab.key
          const count = summary ? tab.count(summary) : null
          return (
            <button
              aria-selected={selected}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] ${selected ? 'bg-[#477a69] text-white' : 'text-[#52675e] hover:bg-[#f3f6f2]'}`}
              key={tab.key}
              onClick={() => setSearchParams({ tab: tab.key })}
              role="tab"
              type="button"
            >
              {tab.label}
              {count !== null && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${selected ? 'bg-white/20 text-white' : tab.key === 'review' && count > 0 ? 'bg-[#f2c94c] text-[#3d2c00]' : 'bg-[#eef3ef] text-[#52675e]'}`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="mb-5 max-w-2xl text-sm text-[#52675e]">{activeTab.intro}</p>

      {state.status === 'loading' && (
        <StatusCard role="status">Loading bookings…</StatusCard>
      )}
      {state.status === 'error' && (
        <StatusCard title="Bookings couldn’t load">
          We couldn’t load these bookings. Please try again later.
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
                    Payment
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
  const status = coordinatorStatusLabel(booking)
  const downpayment = coordinatorPaymentLabel(booking)
  return (
    <tr className="align-top">
      <td className="px-4 py-4">
        <p className="font-bold text-[#173a2e]">{booking.trail.name}</p>
        <p className="mt-1 text-[#52675e]">
          {formatSchedule(booking.scheduledDate, booking.scheduledTime)}
        </p>
        <TrailClosedTag booking={booking} />
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
          {formatMoney({
            amount: booking.payment.amountDueOnline,
            currency: booking.payment.currency,
          })}{' '}
          <span className="text-xs font-normal text-[#70857b]">
            {booking.payment.option === 'FULL' ? 'full' : 'downpayment'}
          </span>
        </p>
        <div className="mt-1">
          <StatusBadge label={downpayment.label} tone={downpayment.tone} />
        </div>
      </td>
      <td className="px-4 py-4">
        <StatusBadge label={status.label} tone={status.tone} />
      </td>
      <td className="px-4 py-4 text-right">
        <Link
          className={reviewLinkClass}
          to={`/coordinator/bookings/${booking.id}`}
        >
          {booking.status === 'PENDING_CONFIRMATION' ? 'Review' : 'View'}
        </Link>
      </td>
    </tr>
  )
}

function QueueCard({ booking }: { booking: CoordinatorBooking }) {
  const status = coordinatorStatusLabel(booking)
  const downpayment = coordinatorPaymentLabel(booking)
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
        <TrailClosedTag booking={booking} />
        <p className="mt-3 text-sm text-[#173a2e]">
          {booking.owner.fullName} · {booking.participantCount}{' '}
          {booking.participantCount === 1 ? 'person' : 'people'} ·{' '}
          {formatMoney({
            amount: booking.payment.amountDueOnline,
            currency: booking.payment.currency,
          })}{' '}
          {booking.payment.option === 'FULL' ? 'full payment' : 'downpayment'}
        </p>
        <p className="mt-2 text-xs font-bold text-[#70857b]">
          {downpayment.label}
        </p>
      </Link>
    </li>
  )
}
