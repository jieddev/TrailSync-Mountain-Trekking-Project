import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import { ApiError } from '../../../lib/api'
import type { BookingParticipant } from '../../../lib/bookings-api'
import {
  assignNextGuide,
  completeTrek,
  confirmBooking,
  getCoordinatorBooking,
  getCoordinatorReceiptImage,
  rejectPayment,
  resendCertificates,
  type CoordinatorBooking,
} from '../../../lib/coordinator-api'
import BookingRestrictionNotice from '../../booking/components/BookingRestrictionNotice'
import PageHeader from '../../booking/components/PageHeader'
import PaymentReceiptList from '../../booking/components/PaymentReceiptList'
import ReceiptImage from '../../booking/components/ReceiptImage'
import StatusBadge from '../../booking/components/StatusBadge'
import StatusCard from '../../booking/components/StatusCard'
import {
  formatMoney,
  formatSchedule,
  manilaTodayIso,
} from '../../booking/lib/booking-form'
import {
  balanceStatusLabel,
  bookingStatusLabel,
  downpaymentStatusLabel,
} from '../../booking/lib/booking-status'
import ConfirmAction from '../components/ConfirmAction'
import {
  dispatchErrorMessage,
  formatClockTime,
  isStaleRefusal,
  type Notice,
} from '../lib/dispatch'
import {
  backLinkClass,
  linkButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../lib/ui'

type BookingState =
  | { status: 'loading' }
  | { status: 'loaded'; booking: CoordinatorBooking }
  | { status: 'not-found' }
  | { status: 'error' }

export default function CoordinatorBookingDetailPage() {
  const { user } = useAuth()
  const { bookingId } = useParams()
  const [state, setState] = useState<BookingState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [isAskingToConfirm, setIsAskingToConfirm] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  // The check-in page hands its result over as a notice.
  const location = useLocation()
  const [notice, setNotice] = useState<Notice | null>(
    (location.state as { notice?: Notice } | null)?.notice ?? null,
  )

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
        text:
          booking.downpaymentStatus === 'VERIFIED'
            ? 'New schedule confirmed. The payment already verified is kept.'
            : 'Payment accepted and booking confirmed.',
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

  async function handleReject(booking: CoordinatorBooking, reason: string) {
    setNotice(null)
    try {
      const idToken = await user!.getIdToken()
      const updated = await rejectPayment(idToken, booking.id, reason)
      setState({ status: 'loaded', booking: updated })
      setNotice({
        tone: 'success',
        text: 'Receipt rejected. The hiker can now upload a new one.',
      })
      return true
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'PAYMENT_NOT_REJECTABLE'
      ) {
        setNotice({
          tone: 'error',
          text: 'This payment was already reviewed. Showing its latest status.',
        })
        setReloadKey((key) => key + 1)
      } else {
        setNotice({
          tone: 'error',
          text: 'We couldn’t reject this payment. Please try again.',
        })
      }
      return false
    }
  }

  async function loadReceiptImage(receiptId: string) {
    const idToken = await user!.getIdToken()
    return getCoordinatorReceiptImage(idToken, bookingId!, receiptId)
  }

  async function runTrekAction(
    action: (idToken: string) => Promise<CoordinatorBooking>,
    success: (booking: CoordinatorBooking) => string,
    fallback: string,
  ) {
    setNotice(null)
    try {
      const idToken = await user!.getIdToken()
      const updated = await action(idToken)
      setState({ status: 'loaded', booking: updated })
      setNotice({ tone: 'success', text: success(updated) })
    } catch (error) {
      setNotice({ tone: 'error', text: dispatchErrorMessage(error, fallback) })
      if (isStaleRefusal(error)) setReloadKey((key) => key + 1)
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
  const balance = balanceStatusLabel(booking)
  const isPending = booking.status === 'PENDING_CONFIRMATION'
  const latestReceipt = booking.payment.receipts[0]
  const receiptToReview =
    booking.downpaymentStatus === 'PENDING_VERIFICATION' &&
    latestReceipt?.status === 'SUBMITTED'
      ? latestReceipt
      : null
  const money = (amount: number) =>
    formatMoney({ amount, currency: booking.payment.currency })

  return (
    <>
      <Link className={backLinkClass} to="/coordinator/bookings">
        ← Booking queue
      </Link>
      <div className="mt-4">
        <PageHeader
          eyebrow={isPending ? 'Booking review' : 'Booking'}
          title={booking.trail.name}
        >
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

      <BookingRestrictionNotice audience="coordinator" booking={booking} />

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
              {balance && (
                <StatusBadge label={balance.label} tone={balance.tone} />
              )}
            </div>
            {isPending && booking.downpaymentStatus === 'VERIFIED' && (
              <p className="mt-3 text-sm leading-6 text-[#52675e]">
                The hiker moved a confirmed trek to a new date. Their verified
                payment is kept; only the new schedule needs confirming.
              </p>
            )}
          </section>

          <section
            aria-labelledby="payment-title"
            className="rounded-2xl border border-[#d5e1da] bg-white p-6"
          >
            <h2 id="payment-title" className="text-sm font-bold text-[#173a2e]">
              GCash payment
            </h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[#70857b]">Option</dt>
                <dd className="font-semibold text-[#173a2e]">
                  {booking.payment.option === 'FULL'
                    ? 'Full payment'
                    : `${booking.paymentRequirement.downpaymentPercent}% downpayment`}
                </dd>
              </div>
              <div>
                <dt className="text-[#70857b]">Expected by GCash</dt>
                <dd className="font-semibold text-[#173a2e]">
                  {money(booking.payment.amountDueOnline)}
                </dd>
              </div>
              <div>
                <dt className="text-[#70857b]">Cash at check-in</dt>
                <dd className="font-semibold text-[#173a2e]">
                  {money(booking.payment.balanceDueOnSite)}
                  {booking.payment.balanceCollectedAt &&
                    ` · collected ${formatClockTime(booking.payment.balanceCollectedAt)}`}
                </dd>
              </div>
            </dl>
            <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-[#70857b]">
              Receipts
            </h3>
            <div className="mt-2">
              <PaymentReceiptList
                loadImage={loadReceiptImage}
                payment={booking.payment}
              />
            </div>
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
                    {person.kind === 'WALK_IN' && (
                      <span className="ml-2 rounded-full bg-[#eef2fb] px-2 py-0.5 text-xs font-bold text-[#2b4a8b]">
                        Walk-in
                      </span>
                    )}
                    <AttendanceBadge attendance={person.attendance} />
                  </span>
                  <span className="text-[#52675e]">
                    Age {person.age} · {person.address}
                    {person.email && ` · ${person.email}`}
                    {person.certificateSentAt && ' · Certificate sent'}
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
                <dt className="text-[#70857b]">Paid by GCash</dt>
                <dd className="font-bold text-[#006b43]">
                  {money(booking.payment.amountDueOnline)}
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

          {!isPending && (
            <section className="rounded-2xl border border-[#d5e1da] bg-white p-6">
              <h2 className="text-sm font-bold text-[#173a2e]">Trek</h2>
              <TrekPanel booking={booking} onAction={runTrekAction} />
            </section>
          )}

          {isPending && (
            <section className="rounded-2xl border border-[#d5e1da] bg-white p-6">
              <h2 className="text-sm font-bold text-[#173a2e]">Review</h2>
              {receiptToReview && (
                <div className="mt-3 flex gap-4">
                  <ReceiptImage
                    alt="Latest GCash receipt from the hiker"
                    className="h-44 w-32"
                    imageKey={receiptToReview.id}
                    load={() => loadReceiptImage(receiptToReview.id)}
                  />
                  <dl className="min-w-0 text-sm">
                    <dt className="text-[#70857b]">Should show</dt>
                    <dd className="font-bold text-[#173a2e]">
                      {money(receiptToReview.amount)}
                    </dd>
                    <dt className="mt-2 text-[#70857b]">Sent to</dt>
                    <dd className="font-semibold text-[#173a2e]">
                      {booking.payment.method.accountNumber}
                    </dd>
                    {receiptToReview.referenceNumber && (
                      <>
                        <dt className="mt-2 text-[#70857b]">Ref. No.</dt>
                        <dd className="break-all font-semibold text-[#173a2e]">
                          {receiptToReview.referenceNumber}
                        </dd>
                      </>
                    )}
                  </dl>
                </div>
              )}
              {receiptToReview || booking.downpaymentStatus === 'VERIFIED' ? (
                isAskingToConfirm ? (
                  <>
                    <p className="mt-3 text-sm leading-6 text-[#52675e]">
                      {receiptToReview
                        ? `Accept the ${money(receiptToReview.amount)} GCash payment and confirm this trek?`
                        : 'Confirm the new schedule?'}{' '}
                      The hiker will see the booking as confirmed.
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
                      {receiptToReview
                        ? 'Check that the screenshot shows the right amount sent to the office GCash account. Test mode: no money moves through TrailSync, so any image can be accepted.'
                        : 'The payment was verified before the reschedule.'}
                    </p>
                    <button
                      className={`mt-4 w-full ${primaryButtonClass}`}
                      onClick={() => {
                        setNotice(null)
                        setIsAskingToConfirm(true)
                      }}
                      type="button"
                    >
                      {receiptToReview
                        ? 'Accept payment & confirm'
                        : 'Confirm new schedule'}
                    </button>
                    {receiptToReview && (
                      <RejectPaymentForm
                        key={receiptToReview.id}
                        onReject={(reason) => handleReject(booking, reason)}
                      />
                    )}
                  </>
                )
              ) : (
                <p className="mt-3 text-sm leading-6 text-[#52675e]">
                  {booking.downpaymentStatus === 'REJECTED'
                    ? 'You rejected the last receipt. Waiting for the hiker to upload a new one.'
                    : 'No receipt has been uploaded for this booking, so it can’t be confirmed.'}
                </p>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  )
}

// Second step of the review: the reason is shown to the hiker.
function RejectPaymentForm({
  onReject,
}: {
  onReject: (reason: string) => Promise<boolean>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = reason.trim()
    if (!trimmed) {
      setError('Tell the hiker why the receipt was rejected.')
      return
    }
    setIsBusy(true)
    const rejected = await onReject(trimmed)
    setIsBusy(false)
    if (rejected) setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <button
        className={`mt-2 w-full ${secondaryButtonClass}`}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Reject payment
      </button>
    )
  }

  return (
    <form
      className="mt-4 border-t border-[#e7ece8] pt-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <label
        className="mb-2 block text-sm font-bold text-[#173a2e]"
        htmlFor="reject-reason"
      >
        Reason (shown to the hiker)
      </label>
      <textarea
        aria-describedby="reject-reason-error"
        aria-invalid={Boolean(error)}
        className="block w-full rounded-xl border border-[#c8d7cf] bg-white px-4 py-3 text-sm text-[#173a2e] outline-none focus:border-[#008755] focus:ring-2 focus:ring-[#008755]/15"
        id="reject-reason"
        maxLength={500}
        onChange={(event) => {
          setReason(event.target.value)
          setError('')
        }}
        placeholder="e.g. The amount doesn’t match, or the screenshot is unreadable."
        rows={3}
        value={reason}
      />
      <p
        aria-live="polite"
        className="min-h-5 pt-1 text-sm text-rose-600"
        id="reject-reason-error"
      >
        {error}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          type="submit"
        >
          {isBusy ? 'Rejecting…' : 'Reject receipt'}
        </button>
        <button
          className={secondaryButtonClass}
          disabled={isBusy}
          onClick={() => setIsOpen(false)}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function AttendanceBadge({
  attendance,
}: {
  attendance: BookingParticipant['attendance']
}) {
  if (attendance === 'PRESENT') {
    return (
      <span className="ml-2 rounded-full bg-[#e8f1eb] px-2 py-0.5 text-xs font-bold text-[#006b43]">
        Present
      </span>
    )
  }
  if (attendance === 'ABSENT') {
    return (
      <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
        Absent
      </span>
    )
  }
  return null
}

// Hikers who went on the trek but whose certificate hasn't been emailed.
function unsentCertificates(booking: CoordinatorBooking) {
  return booking.participants.filter(
    (person) => person.attendance !== 'ABSENT' && !person.certificateSentAt,
  ).length
}

type TrekAction = (
  action: (idToken: string) => Promise<CoordinatorBooking>,
  success: (booking: CoordinatorBooking) => string,
  fallback: string,
) => Promise<void>

// Check-in and dispatch actions for a confirmed booking, by lifecycle status.
function TrekPanel({
  booking,
  onAction,
}: {
  booking: CoordinatorBooking
  onAction: TrekAction
}) {
  const textClass = 'mt-3 text-sm leading-6 text-[#52675e]'
  const guideName = booking.guide?.fullName ?? 'The guide'

  switch (booking.status) {
    case 'CONFIRMED':
      return booking.scheduledDate === manilaTodayIso() ? (
        <>
          <p className={textClass}>
            This group is scheduled for today. Check them in when they arrive at
            the office.
          </p>
          <Link
            className={`mt-4 ${linkButtonClass}`}
            to={`/coordinator/bookings/${booking.id}/check-in`}
          >
            Check in group
          </Link>
        </>
      ) : (
        <p className={textClass}>
          Check-in opens on the trek day. A group arriving on another day must
          reschedule first.
        </p>
      )
    case 'CHECKED_IN':
      return (
        <>
          <p className={textClass}>
            Checked in at {formatClockTime(booking.checkedInAt!)}. No guide was
            free, so the group is waiting for the next available guide.
          </p>
          <div className="mt-4">
            <ConfirmAction
              busyLabel="Assigning…"
              confirmLabel="Yes, assign"
              fullWidth
              label="Assign next guide"
              onConfirm={() =>
                onAction(
                  (idToken) => assignNextGuide(idToken, booking.id),
                  (updated) =>
                    `${updated.guide?.fullName ?? 'A guide'} is assigned to this group.`,
                  'We couldn’t assign a guide. Please try again.',
                )
              }
              question="Assign the guide at the front of the queue to this group?"
            />
          </div>
        </>
      )
    case 'GUIDE_ASSIGNED':
    case 'IN_PROGRESS': {
      // The guide completes a started trek from the guide app; this button is
      // the office fallback (e.g. the guide's phone is dead or offline).
      const completeAction = (
        <div className="mt-4">
          <ConfirmAction
            busyLabel="Completing…"
            confirmLabel="Yes, completed"
            fullWidth
            label="Mark trek completed"
            onConfirm={() =>
              onAction(
                (idToken) => completeTrek(idToken, booking.id),
                () =>
                  `Trek completed. ${guideName} is back at the end of the guide queue.`,
                'We couldn’t complete this trek. Please try again.',
              )
            }
            question={`Has the group returned? ${guideName} goes back to the end of the guide queue.`}
          />
        </div>
      )
      return booking.status === 'IN_PROGRESS' ? (
        <>
          <p className={textClass}>
            <span className="font-semibold text-[#173a2e]">{guideName}</span>{' '}
            started the trek
            {booking.trekStartedAt &&
              ` at ${formatClockTime(booking.trekStartedAt)}`}
            . The guide completes it from the guide app when the group returns.
          </p>
          {completeAction}
        </>
      ) : (
        <>
          <p className={textClass}>
            <span className="font-semibold text-[#173a2e]">{guideName}</span> is
            leading this group
            {booking.guideAssignedAt &&
              ` (assigned ${formatClockTime(booking.guideAssignedAt)})`}
            . The guide hasn’t started the trek in the guide app yet.
          </p>
          {completeAction}
        </>
      )
    }
    case 'COMPLETED': {
      const unsent = unsentCertificates(booking)
      return (
        <>
          <p className={textClass}>
            Completed
            {booking.completedAt &&
              ` at ${formatClockTime(booking.completedAt)}`}
            {booking.guide && ` with ${booking.guide.fullName}`}.
          </p>
          <p className={textClass}>
            {unsent === 0
              ? 'Every hiker’s certificate has been emailed.'
              : `${unsent} certificate${unsent === 1 ? '' : 's'} not emailed yet. They are sent right after completion; resend if an email failed.`}
          </p>
          {unsent > 0 && (
            <div className="mt-4">
              <ConfirmAction
                busyLabel="Sending…"
                confirmLabel="Yes, resend"
                fullWidth
                label="Resend certificates"
                onConfirm={() =>
                  onAction(
                    async (idToken) =>
                      (await resendCertificates(idToken, booking.id)).booking,
                    (updated) =>
                      unsentCertificates(updated) === 0
                        ? 'Certificates emailed.'
                        : 'Some certificates still couldn’t be emailed. Please try again later.',
                    'We couldn’t resend the certificates. Please try again.',
                  )
                }
                question="Email the certificates that haven’t been sent yet?"
              />
            </div>
          )}
        </>
      )
    }
    default:
      return null
  }
}
