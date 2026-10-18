import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import { ApiError } from '../../../lib/api'
import {
  confirmBooking,
  getCoordinatorBooking,
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

type BookingState =
  | { status: 'loading' }
  | { status: 'loaded'; booking: CoordinatorBooking }
  | { status: 'not-found' }
  | { status: 'error' }

type Notice = { tone: 'success' | 'error'; text: string }

const backLinkClass =
  'text-sm font-bold text-[#007e4f] underline-offset-4 hover:underline'
const primaryButtonClass =
  'rounded-lg bg-[#008755] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#006b43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'
const secondaryButtonClass =
  'rounded-lg border border-[#d5e1da] bg-white px-4 py-2.5 text-sm font-bold text-[#173a2e] hover:bg-[#f3f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] disabled:opacity-60'

export default function CoordinatorBookingDetailPage() {
  const { user } = useAuth()
  const { bookingId } = useParams()
  const [state, setState] = useState<BookingState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [isAskingToConfirm, setIsAskingToConfirm] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    let isCurrent = true

    async function loadBooking() {
      try {
        const idToken = await user!.getIdToken()
        const booking = await getCoordinatorBooking(idToken, bookingId!)
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
  }, [user, bookingId, reloadKey])

  async function handleConfirm(booking: CoordinatorBooking) {
    setIsConfirming(true)
    setNotice(null)
    try {
      const idToken = await user!.getIdToken()
      const confirmed = await confirmBooking(idToken, booking.id)
      // The confirm response has no owner, so keep the one already loaded.
      setState({ status: 'loaded', booking: { ...booking, ...confirmed } })
      setNotice({
        tone: 'success',
        text: 'Booking confirmed and downpayment marked as verified.',
      })
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'BOOKING_NOT_CONFIRMABLE'
      ) {
        setNotice({
          tone: 'error',
          text: 'This booking was already updated. Showing its latest status.',
        })
        setReloadKey((key) => key + 1)
      } else {
        setNotice({
          tone: 'error',
          text: 'We couldn’t confirm this booking. Please try again.',
        })
      }
    } finally {
      setIsConfirming(false)
      setIsAskingToConfirm(false)
    }
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
            ? 'We couldn’t find this booking.'
            : 'We couldn’t load this booking. Please try again later.'}
        </p>
        <Link
          className={`mt-4 inline-flex ${backLinkClass}`}
          to="/coordinator/bookings"
        >
          Back to the booking queue
        </Link>
      </StatusCard>
    )
  }

  const { booking } = state
  const status = bookingStatusLabel(booking)
  const downpayment = downpaymentStatusLabel(booking)
  const isPending = booking.status === 'PENDING_CONFIRMATION'

  return (
    <>
      <Link className={backLinkClass} to="/coordinator/bookings">
        ← Booking queue
      </Link>
      <div className="mt-4">
        <PageHeader eyebrow="Booking review" title={booking.trail.name}>
          {formatSchedule(booking.scheduledDate, booking.scheduledTime)}
        </PageHeader>
      </div>

      {notice && (
        <p
          className={`mb-6 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === 'success' ? 'border-[#b9d8c8] bg-[#eef7f1] text-[#006b43]' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
          role={notice.tone === 'success' ? 'status' : 'alert'}
        >
          {notice.text}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
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
            {isPending && booking.downpaymentStatus === 'VERIFIED' && (
              <p className="mt-3 text-sm leading-6 text-[#52675e]">
                The hiker moved a confirmed trek to a new date. Their
                downpayment credit is kept; only the new schedule needs
                confirming.
              </p>
            )}
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
                        Booking owner
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
        </div>

        <aside className="grid gap-6">
          <section className="rounded-2xl border border-[#d5e1da] bg-white p-6">
            <h2 className="text-sm font-bold text-[#173a2e]">Booked by</h2>
            <p className="mt-3 text-sm font-semibold text-[#173a2e]">
              {booking.owner.fullName}
            </p>
            <a
              className="mt-1 block truncate text-sm text-[#007e4f] underline-offset-4 hover:underline"
              href={`mailto:${booking.owner.email}`}
            >
              {booking.owner.email}
            </a>
          </section>

          <section className="rounded-2xl border border-[#d5e1da] bg-white p-6">
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
                  Downpayment ({booking.paymentRequirement.downpaymentPercent}
                  %)
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
          </section>

          {isPending && (
            <section className="rounded-2xl border border-[#d5e1da] bg-white p-6">
              <h2 className="text-sm font-bold text-[#173a2e]">Review</h2>
              {isAskingToConfirm ? (
                <>
                  <p className="mt-3 text-sm leading-6 text-[#52675e]">
                    Confirm this trek and mark the{' '}
                    {formatMoney(booking.paymentRequirement)} downpayment as
                    verified? The hiker will see the booking as confirmed.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className={primaryButtonClass}
                      disabled={isConfirming}
                      onClick={() => void handleConfirm(booking)}
                      type="button"
                    >
                      {isConfirming ? 'Confirming…' : 'Yes, confirm'}
                    </button>
                    <button
                      className={secondaryButtonClass}
                      disabled={isConfirming}
                      onClick={() => setIsAskingToConfirm(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm leading-6 text-[#52675e]">
                    Check the downpayment before confirming. Payment
                    verification is simulated; no money is processed in
                    TrailSync.
                  </p>
                  <button
                    className={`mt-4 w-full ${primaryButtonClass}`}
                    onClick={() => {
                      setNotice(null)
                      setIsAskingToConfirm(true)
                    }}
                    type="button"
                  >
                    Confirm & verify downpayment
                  </button>
                </>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  )
}
