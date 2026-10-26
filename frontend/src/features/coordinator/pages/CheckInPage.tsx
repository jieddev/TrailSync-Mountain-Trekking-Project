import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import { ApiError } from '../../../lib/api'
import {
  checkInBooking,
  getCoordinatorBooking,
  type CoordinatorBooking,
} from '../../../lib/coordinator-api'
import PageHeader from '../../booking/components/PageHeader'
import StatusCard from '../../booking/components/StatusCard'
import {
  formatSchedule,
  isOptionalEmail,
  manilaTodayIso,
} from '../../booking/lib/booking-form'
import { dispatchErrorMessage, type Notice } from '../lib/dispatch'
import {
  backLinkClass,
  cardClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../lib/ui'

type PageState =
  | { status: 'loading' }
  | { status: 'loaded'; booking: CoordinatorBooking }
  | { status: 'not-found' }
  | { status: 'error' }

type WalkInValues = {
  name: string
  age: string
  address: string
  email: string
}
type Errors = Record<string, string>

const emptyWalkIn: WalkInValues = { name: '', age: '', address: '', email: '' }
const walkInLabels: Record<keyof WalkInValues, string> = {
  name: 'Full name',
  age: 'Age',
  address: 'Address',
  email: 'Email (optional)',
}
const inputClass =
  'w-full rounded-lg border border-[#cfdcd4] bg-white px-3 py-2 text-sm text-[#173a2e] focus:border-[#008755] focus:outline-none focus:ring-2 focus:ring-[#008755]/25'

// Mirrors the API's check-in rules so mistakes show before submitting.
function validate(presentCount: number, walkIns: WalkInValues[], max: number) {
  const errors: Errors = {}
  if (presentCount === 0) {
    errors.attendance = 'At least one booked participant must be present.'
  }
  if (presentCount + walkIns.length > max) {
    errors.walkIns = `At most ${max} people can be checked in on one package. Extra people need their own booking.`
  }
  walkIns.forEach((person, index) => {
    if (!person.name.trim())
      errors[`walkIns.${index}.name`] = 'Name is required.'
    if (!/^\d+$/.test(person.age.trim()) || Number(person.age) < 1) {
      errors[`walkIns.${index}.age`] = 'Enter a valid age.'
    }
    if (!person.address.trim()) {
      errors[`walkIns.${index}.address`] = 'Address is required.'
    }
    if (!isOptionalEmail(person.email)) {
      errors[`walkIns.${index}.email`] =
        'Enter a valid email or leave it blank.'
    }
  })
  return errors
}

export default function CheckInPage() {
  const { user } = useAuth()
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const [present, setPresent] = useState<Record<string, boolean>>({})
  const [walkIns, setWalkIns] = useState<WalkInValues[]>([])
  const [errors, setErrors] = useState<Errors>({})
  const [notice, setNotice] = useState<Notice | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isCurrent = true

    async function loadBooking() {
      try {
        const idToken = await user!.getIdToken()
        const booking = await getCoordinatorBooking(idToken, bookingId!)
        if (!isCurrent) return
        setState({ status: 'loaded', booking })
        // Everyone on the booking starts as present.
        setPresent(
          Object.fromEntries(booking.participants.map((p) => [p.id, true])),
        )
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

  if (state.status === 'loading') {
    return <StatusCard role="status">Loading booking…</StatusCard>
  }
  if (state.status !== 'loaded') {
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
          to="/coordinator/dispatch"
        >
          Back to check-in & dispatch
        </Link>
      </StatusCard>
    )
  }

  const { booking } = state
  const detailPath = `/coordinator/bookings/${booking.id}`
  const max = booking.package.maximumParticipants

  if (
    booking.status !== 'CONFIRMED' ||
    booking.scheduledDate !== manilaTodayIso()
  ) {
    return (
      <StatusCard title="This group can’t be checked in">
        <p>
          {booking.status !== 'CONFIRMED'
            ? 'Only confirmed bookings can be checked in, and this one has already moved on.'
            : `This trek is scheduled for ${formatSchedule(booking.scheduledDate, booking.scheduledTime)}. Groups check in on their trek day; arriving on another day needs a reschedule first.`}
        </p>
        <Link className={`mt-4 inline-flex ${backLinkClass}`} to={detailPath}>
          Back to the booking
        </Link>
      </StatusCard>
    )
  }

  const presentCount = booking.participants.filter((p) => present[p.id]).length
  const total = presentCount + walkIns.length

  function updateWalkIn(
    index: number,
    field: keyof WalkInValues,
    value: string,
  ) {
    setWalkIns((current) =>
      current.map((person, i) =>
        i === index ? { ...person, [field]: value } : person,
      ),
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setNotice(null)
    const found = validate(presentCount, walkIns, max)
    setErrors(found)
    if (Object.keys(found).length) return

    setIsSubmitting(true)
    try {
      const idToken = await user!.getIdToken()
      const checkedIn = await checkInBooking(idToken, booking.id, {
        attendance: booking.participants.map((p) => ({
          participantId: p.id,
          present: Boolean(present[p.id]),
        })),
        walkIns: walkIns.map((person) => ({
          name: person.name.trim(),
          age: Number(person.age),
          address: person.address.trim(),
          ...(person.email.trim() && { email: person.email.trim() }),
        })),
      })
      navigate(detailPath, {
        state: {
          notice: {
            tone: 'success',
            text: checkedIn.guide
              ? `Group checked in. ${checkedIn.guide.fullName} is assigned as their guide.`
              : 'Group checked in. No guide is available yet, so the group is waiting. Assign the next guide once one reports in.',
          } satisfies Notice,
        },
      })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        setErrors(
          Object.fromEntries(error.details.map((d) => [d.field, d.message])),
        )
      } else {
        setNotice({
          tone: 'error',
          text: dispatchErrorMessage(
            error,
            'We couldn’t check in this group. Please try again.',
          ),
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Link className={backLinkClass} to={detailPath}>
        ← Booking
      </Link>
      <div className="mt-4">
        <PageHeader eyebrow="Check-in" title={booking.trail.name}>
          {formatSchedule(booking.scheduledDate, booking.scheduledTime)} ·
          booked by {booking.owner.fullName}. Mark who arrived and add any
          walk-ins. The guide at the front of the queue is assigned when you
          check the group in.
        </PageHeader>
      </div>

      {notice && (
        <p
          className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
          role="alert"
        >
          {notice.text}
        </p>
      )}

      <form className="grid gap-6" noValidate onSubmit={handleSubmit}>
        <fieldset className={cardClass}>
          <legend className="sr-only">Booked participants</legend>
          <h2 className="text-sm font-bold text-[#173a2e]">
            Booked participants
          </h2>
          <ul className="mt-3 divide-y divide-[#e7ece8]">
            {booking.participants.map((person) => (
              <li
                className="flex flex-col gap-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                key={person.id}
              >
                <span>
                  <span className="font-semibold text-[#173a2e]">
                    {person.name}
                  </span>
                  <span className="block text-[#52675e]">
                    Age {person.age} · {person.address}
                  </span>
                </span>
                <span
                  aria-label={`Attendance for ${person.name}`}
                  className="inline-flex rounded-lg border border-[#d5e1da] p-1"
                  role="radiogroup"
                >
                  {[true, false].map((value) => (
                    <button
                      aria-checked={present[person.id] === value}
                      className={`rounded-md px-3 py-1.5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] ${present[person.id] === value ? (value ? 'bg-[#008755] text-white' : 'bg-rose-600 text-white') : 'text-[#52675e] hover:bg-[#f3f6f2]'}`}
                      key={String(value)}
                      onClick={() =>
                        setPresent((current) => ({
                          ...current,
                          [person.id]: value,
                        }))
                      }
                      role="radio"
                      type="button"
                    >
                      {value ? 'Present' : 'Absent'}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          {errors.attendance && (
            <p
              className="mt-2 text-sm font-semibold text-rose-700"
              role="alert"
            >
              {errors.attendance}
            </p>
          )}
        </fieldset>

        <fieldset className={cardClass}>
          <legend className="sr-only">Walk-ins</legend>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[#173a2e]">Walk-ins</h2>
            <button
              className={secondaryButtonClass}
              disabled={total >= max}
              onClick={() => setWalkIns((current) => [...current, emptyWalkIn])}
              type="button"
            >
              Add walk-in
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#52675e]">
            People who arrived but weren’t on the booking. The package price
            doesn’t change.
          </p>
          {walkIns.map((person, index) => (
            <div
              className="mt-4 grid gap-3 rounded-xl border border-[#e7ece8] p-4 sm:grid-cols-[2fr_1fr_2fr_2fr_auto] sm:items-start"
              key={index}
            >
              {(['name', 'age', 'address', 'email'] as const).map((field) => {
                const id = `walk-in-${index}-${field}`
                const error = errors[`walkIns.${index}.${field}`]
                return (
                  <div key={field}>
                    <label
                      className="mb-1 block text-xs font-bold text-[#52675e]"
                      htmlFor={id}
                    >
                      {walkInLabels[field]}
                    </label>
                    <input
                      aria-describedby={error ? `${id}-error` : undefined}
                      aria-invalid={Boolean(error)}
                      className={inputClass}
                      id={id}
                      inputMode={field === 'age' ? 'numeric' : undefined}
                      type={field === 'email' ? 'email' : 'text'}
                      onChange={(event) =>
                        updateWalkIn(index, field, event.target.value)
                      }
                      value={person[field]}
                    />
                    {error && (
                      <p
                        className="mt-1 text-xs font-semibold text-rose-700"
                        id={`${id}-error`}
                      >
                        {error}
                      </p>
                    )}
                  </div>
                )
              })}
              <button
                className="self-end rounded-lg px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                onClick={() =>
                  setWalkIns((current) => current.filter((_, i) => i !== index))
                }
                type="button"
              >
                Remove
              </button>
            </div>
          ))}
          {errors.walkIns && (
            <p
              className="mt-3 text-sm font-semibold text-rose-700"
              role="alert"
            >
              {errors.walkIns}
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-3 rounded-2xl border border-[#d5e1da] bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <p
            aria-live="polite"
            className={`text-sm font-bold ${total === 0 || total > max ? 'text-rose-700' : 'text-[#173a2e]'}`}
          >
            {total} of {max} checked in
            {walkIns.length > 0 &&
              ` (${presentCount} booked, ${walkIns.length} walk-in${walkIns.length === 1 ? '' : 's'})`}
          </p>
          <button
            className={primaryButtonClass}
            disabled={isSubmitting || presentCount === 0 || total > max}
            type="submit"
          >
            {isSubmitting ? 'Checking in…' : 'Check in & assign guide'}
          </button>
        </div>
      </form>
    </>
  )
}
