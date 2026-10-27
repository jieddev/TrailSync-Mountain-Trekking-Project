import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import {
  assignNextGuide,
  completeTrek,
  listCoordinatorBookings,
  listGuides,
  type CoordinatorBooking,
  type Guide,
} from '../../../lib/coordinator-api'
import { TrailClosedTag } from '../../booking/components/BookingRestrictionNotice'
import PageHeader from '../../booking/components/PageHeader'
import StatusCard from '../../booking/components/StatusCard'
import { formatSchedule } from '../../booking/lib/booking-form'
import ConfirmAction from '../components/ConfirmAction'
import {
  dispatchErrorMessage,
  formatClockTime,
  type Notice,
} from '../lib/dispatch'
import { cardClass, linkButtonClass } from '../lib/ui'

type Board = {
  arrivals: CoordinatorBooking[]
  waiting: CoordinatorBooking[]
  onTrail: CoordinatorBooking[]
  queue: Guide[]
}

type BoardState =
  | { status: 'loading' }
  | { status: 'loaded'; board: Board }
  | { status: 'error' }

export default function DispatchPage() {
  const { user } = useAuth()
  const [state, setState] = useState<BoardState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    let isCurrent = true

    async function loadBoard() {
      try {
        const idToken = await user!.getIdToken()
        const [arrivals, waiting, assigned, started, guides] =
          await Promise.all([
            listCoordinatorBookings(idToken, 'CONFIRMED', { today: true }),
            listCoordinatorBookings(idToken, 'CHECKED_IN'),
            listCoordinatorBookings(idToken, 'GUIDE_ASSIGNED'),
            listCoordinatorBookings(idToken, 'IN_PROGRESS'),
            listGuides(idToken),
          ])
        // Groups whose guide hasn't started the trek in the app yet come first.
        const onTrail = [...assigned, ...started]
        const queue = guides.filter((guide) => guide.dutyStatus === 'AVAILABLE')
        if (isCurrent) {
          setState({
            status: 'loaded',
            board: { arrivals, waiting, onTrail, queue },
          })
        }
      } catch {
        if (isCurrent) setState({ status: 'error' })
      }
    }

    void loadBoard()
    return () => {
      isCurrent = false
    }
  }, [user, reloadKey])

  async function runAction(
    action: (idToken: string) => Promise<CoordinatorBooking>,
    success: (booking: CoordinatorBooking) => string,
    fallback: string,
  ) {
    setNotice(null)
    try {
      const idToken = await user!.getIdToken()
      const booking = await action(idToken)
      setNotice({ tone: 'success', text: success(booking) })
    } catch (error) {
      setNotice({ tone: 'error', text: dispatchErrorMessage(error, fallback) })
    }
    setReloadKey((key) => key + 1)
  }

  return (
    <>
      <PageHeader eyebrow="Coordinator" title="Check-in & dispatch">
        Check in today’s groups at the office. Each check-in assigns the guide
        at the front of the queue; groups wait here when no guide is free.
      </PageHeader>

      {notice && (
        <p
          className={`mb-6 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === 'success' ? 'border-[#b9d8c8] bg-[#eef7f1] text-[#006b43]' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
          role={notice.tone === 'success' ? 'status' : 'alert'}
        >
          {notice.text}
        </p>
      )}

      {state.status === 'loading' && (
        <StatusCard role="status">Loading today’s groups…</StatusCard>
      )}
      {state.status === 'error' && (
        <StatusCard title="Check-in couldn’t load">
          We couldn’t load today’s groups. Please try again later.
        </StatusCard>
      )}
      {state.status === 'loaded' && (
        <div className="grid gap-6">
          <section
            className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}
          >
            <p className="text-sm text-[#173a2e]">
              {state.board.queue.length === 0 ? (
                <span className="font-bold text-[#7a5300]">
                  No guides are in the queue.
                </span>
              ) : (
                <>
                  <span className="font-bold">
                    {state.board.queue.length} guide
                    {state.board.queue.length === 1 ? '' : 's'} in the queue.
                  </span>{' '}
                  Next up: {state.board.queue[0].fullName}
                </>
              )}
            </p>
            <Link className={linkButtonClass} to="/coordinator/guides">
              Guide queue
            </Link>
          </section>

          <BoardSection
            empty="No more confirmed groups are scheduled for today."
            title="Today’s arrivals"
            count={state.board.arrivals.length}
          >
            {state.board.arrivals.map((booking) => (
              <BookingRow booking={booking} key={booking.id}>
                <Link
                  className={linkButtonClass}
                  to={`/coordinator/bookings/${booking.id}/check-in`}
                >
                  Check in
                </Link>
              </BookingRow>
            ))}
          </BoardSection>

          <BoardSection
            empty="No groups are waiting for a guide."
            title="Waiting for a guide"
            count={state.board.waiting.length}
          >
            {state.board.waiting.map((booking, index) => (
              <BookingRow
                booking={booking}
                detail={`Checked in ${formatClockTime(booking.checkedInAt!)}${index === 0 ? ' · waiting longest' : ''}`}
                key={booking.id}
              >
                <ConfirmAction
                  busyLabel="Assigning…"
                  confirmLabel="Yes, assign"
                  label="Assign next guide"
                  onConfirm={() =>
                    runAction(
                      (idToken) => assignNextGuide(idToken, booking.id),
                      (assigned) =>
                        `${assigned.guide?.fullName ?? 'A guide'} is assigned to ${booking.owner.fullName}’s group.`,
                      'We couldn’t assign a guide. Please try again.',
                    )
                  }
                  question={
                    state.board.queue.length
                      ? `Assign ${state.board.queue[0].fullName}, the guide at the front of the queue, to this group?`
                      : 'No guide is in the queue right now. Try anyway?'
                  }
                />
              </BookingRow>
            ))}
          </BoardSection>

          <BoardSection
            empty="No groups are on the trail."
            title="On the trail"
            count={state.board.onTrail.length}
          >
            {state.board.onTrail.map((booking) => (
              <BookingRow
                booking={booking}
                detail={`Guide: ${booking.guide?.fullName ?? '—'} · ${onTrailDetail(booking)}`}
                key={booking.id}
              >
                <ConfirmAction
                  busyLabel="Completing…"
                  confirmLabel="Yes, completed"
                  label="Mark completed"
                  onConfirm={() =>
                    runAction(
                      (idToken) => completeTrek(idToken, booking.id),
                      () =>
                        `Trek completed. ${booking.guide?.fullName ?? 'The guide'} is back at the end of the queue.`,
                      'We couldn’t complete this trek. Please try again.',
                    )
                  }
                  question={`Has ${booking.owner.fullName}’s group returned? ${booking.guide?.fullName ?? 'The guide'} goes back to the end of the queue.`}
                />
              </BookingRow>
            ))}
          </BoardSection>
        </div>
      )}
    </>
  )
}

function onTrailDetail(booking: CoordinatorBooking) {
  if (booking.trekStartedAt) {
    return `trek started ${formatClockTime(booking.trekStartedAt)}`
  }
  return booking.guideAssignedAt
    ? `assigned ${formatClockTime(booking.guideAssignedAt)}, not started yet`
    : 'not started yet'
}

function BoardSection({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count: number
  empty: string
  children: ReactNode
}) {
  return (
    <section className={cardClass}>
      <h2 className="text-sm font-bold text-[#173a2e]">
        {title} ({count})
      </h2>
      {count === 0 ? (
        <p className="mt-3 text-sm text-[#52675e]">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#e7ece8]">{children}</ul>
      )}
    </section>
  )
}

function BookingRow({
  booking,
  detail,
  children,
}: {
  booking: CoordinatorBooking
  detail?: string
  children: ReactNode
}) {
  return (
    <li className="flex flex-col gap-3 py-4 text-sm sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Link
          className="font-bold text-[#173a2e] underline-offset-4 hover:underline"
          to={`/coordinator/bookings/${booking.id}`}
        >
          {booking.owner.fullName} · {booking.trail.name}
        </Link>
        <p className="mt-1 text-[#52675e]">
          {formatSchedule(booking.scheduledDate, booking.scheduledTime)} ·{' '}
          {booking.participantCount}{' '}
          {booking.participantCount === 1 ? 'person' : 'people'}
        </p>
        {detail && <p className="mt-1 text-[#70857b]">{detail}</p>}
        <TrailClosedTag booking={booking} />
      </div>
      <div className="sm:max-w-xs sm:text-right">{children}</div>
    </li>
  )
}
