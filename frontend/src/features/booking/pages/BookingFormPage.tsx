import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import { ApiError } from '../../../lib/api'
import { createBooking } from '../../../lib/bookings-api'
import { closureOn } from '../../../lib/trail-restrictions-api'
import { listTrails, type Trail } from '../../../lib/trails-api'
import AuthFormField from '../../auth/components/AuthFormField'
import AuthSubmitButton from '../../auth/components/AuthSubmitButton'
import AgreementCheckbox from '../../legal/components/AgreementCheckbox'
import { useHikerProfile } from '../../home/hiker-profile'
import DayForecastNote from '../../weather/components/DayForecastNote'
import { useWeather } from '../../weather/lib/use-weather'
import Alert from '../components/Alert'
import GcashPaymentPanel from '../components/GcashPaymentPanel'
import ReceiptUploadField from '../components/ReceiptUploadField'
import PageHeader from '../components/PageHeader'
import StatusCard from '../components/StatusCard'
import {
  amountDueOnline,
  type BookingFormErrors,
  type BookingFormValues,
  emptyParticipant,
  fieldErrorsFromApi,
  formatDateRange,
  formatMoney,
  MIN_PARTICIPANT_AGE,
  todayLocalIso,
  toCreateBookingInput,
  validateBookingForm,
} from '../lib/booking-form'
import { useTrailClosures } from '../lib/use-trail-closures'

type TrailsState =
  | { status: 'loading' }
  | { status: 'loaded'; trails: Trail[] }
  | { status: 'error' }

export type BookingCreatedState = { successMessage: string }

const initialValues: BookingFormValues = {
  trailId: '',
  scheduledDate: '',
  scheduledTime: '',
  ownerAddress: '',
  additionalParticipants: [],
  paymentOption: '',
  receipt: null,
  referenceNumber: '',
  acceptedWaiver: false,
}

const secondaryButtonClass =
  'rounded-lg border border-[#d5e1da] bg-white px-3 py-2 text-sm font-bold text-[#007e4f] hover:bg-[#f3f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] disabled:cursor-not-allowed disabled:opacity-50'

export default function BookingFormPage() {
  const { user } = useAuth()
  const profile = useHikerProfile()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [trailsState, setTrailsState] = useState<TrailsState>({
    status: 'loading',
  })
  const [values, setValues] = useState<BookingFormValues>(initialValues)
  const [errors, setErrors] = useState<BookingFormErrors>({})
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const requestedTrailId = searchParams.get('trailId')
  const weather = useWeather()
  const closures = useTrailClosures(
    trailsState.status === 'loaded'
      ? trailsState.trails.map((trail) => trail.id)
      : [],
  )

  useEffect(() => {
    let isCurrent = true
    listTrails()
      .then((trails) => {
        if (!isCurrent) return
        setTrailsState({ status: 'loaded', trails })
        const preselected =
          trails.find((trail) => trail.id === requestedTrailId) ??
          (trails.length === 1 ? trails[0] : undefined)
        if (preselected) {
          setValues((current) => ({ ...current, trailId: preselected.id }))
        }
      })
      .catch(() => {
        if (isCurrent) setTrailsState({ status: 'error' })
      })
    return () => {
      isCurrent = false
    }
  }, [requestedTrailId])

  if (trailsState.status === 'loading') {
    return <StatusCard role="status">Loading the booking form…</StatusCard>
  }
  if (trailsState.status === 'error') {
    return (
      <StatusCard title="Booking form unavailable">
        We couldn’t load the trails. Please try again later.
      </StatusCard>
    )
  }
  if (trailsState.trails.length === 0) {
    return (
      <StatusCard title="No trails open">
        No trails are open for booking right now. Please check back later.
      </StatusCard>
    )
  }

  const { trails } = trailsState
  const selectedTrail = trails.find((trail) => trail.id === values.trailId)
  // The limit comes from the API package; before a trail is chosen, use the
  // strictest one so the form never allows more than any package permits.
  const maxParticipants = selectedTrail
    ? selectedTrail.package.maximumParticipants
    : Math.min(...trails.map((trail) => trail.package.maximumParticipants))
  const maxAdditional = maxParticipants - 1
  const groupSize = 1 + values.additionalParticipants.length
  const today = todayLocalIso()
  const closureOnDate =
    selectedTrail && values.scheduledDate
      ? closureOn(closures[selectedTrail.id] ?? [], values.scheduledDate)
      : null

  function updateValues(next: BookingFormValues) {
    setValues(next)
    if (hasSubmitted) setErrors(validateBookingForm(next, maxAdditional, today))
  }

  function setField(
    name:
      | 'trailId'
      | 'scheduledDate'
      | 'scheduledTime'
      | 'ownerAddress'
      | 'paymentOption'
      | 'referenceNumber',
    value: string,
  ) {
    updateValues({ ...values, [name]: value })
  }

  function setParticipantField(
    index: number,
    name: keyof typeof emptyParticipant,
    value: string,
  ) {
    updateValues({
      ...values,
      additionalParticipants: values.additionalParticipants.map(
        (person, current) =>
          current === index ? { ...person, [name]: value } : person,
      ),
    })
  }

  function addParticipant() {
    updateValues({
      ...values,
      additionalParticipants: [
        ...values.additionalParticipants,
        { ...emptyParticipant },
      ],
    })
  }

  function removeParticipant(index: number) {
    updateValues({
      ...values,
      additionalParticipants: values.additionalParticipants.filter(
        (_, current) => current !== index,
      ),
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setHasSubmitted(true)
    setFormError('')
    const validationErrors = validateBookingForm(values, maxAdditional, today)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      setFormError('Review the highlighted fields and try again.')
      return
    }

    setIsSubmitting(true)
    try {
      const idToken = await user!.getIdToken()
      const booking = await createBooking(
        idToken,
        toCreateBookingInput(values),
        {
          receipt: values.receipt!,
          referenceNumber: values.referenceNumber,
        },
      )
      navigate(`/bookings/${booking.id}`, {
        state: {
          successMessage:
            'Your booking and GCash receipt were sent. A tourism coordinator will check your payment and confirm.',
        } satisfies BookingCreatedState,
      })
    } catch (error) {
      // The owner's age comes from their profile, so an age problem has no
      // field to highlight; show the server's message instead.
      const ownerAgeError =
        error instanceof ApiError &&
        error.details.find((detail) => detail.field === 'ownerAge')
      if (ownerAgeError) {
        setFormError(ownerAgeError.message)
      } else if (error instanceof ApiError && error.status === 422) {
        setErrors(fieldErrorsFromApi(error.details))
        setFormError('Review the highlighted fields and try again.')
      } else if (
        error instanceof ApiError &&
        error.code === 'TRAIL_RESTRICTED'
      ) {
        setErrors({
          scheduledDate:
            'This trail is closed on this date. Choose another date.',
        })
        setFormError('This trail is closed on the date you picked.')
      } else if (error instanceof ApiError && error.status === 413) {
        setErrors({ receipt: 'The screenshot must be 5 MB or smaller.' })
        setFormError('Review the highlighted fields and try again.')
      } else if (error instanceof ApiError && error.status === 403) {
        setFormError('Only hiker accounts can book a trek.')
      } else {
        setFormError('We couldn’t send your booking. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="New booking" title="Book a trek">
        Pick a trail and schedule, then tell us who is joining. You count as one
        of the participants.
      </PageHeader>

      <form
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start"
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="grid gap-6">
          <fieldset
            aria-describedby="trailId-error"
            className="rounded-2xl border border-[#d5e1da] bg-white p-6"
          >
            <legend className="px-1 text-sm font-bold text-[#173a2e]">
              Trail
            </legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {trails.map((trail) => (
                <label
                  className={`flex cursor-pointer flex-col rounded-xl border p-4 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#008755] ${values.trailId === trail.id ? 'border-[#008755] bg-[#f1f8f4]' : 'border-[#c8d7cf] hover:bg-[#f7faf8]'}`}
                  key={trail.id}
                >
                  <input
                    checked={values.trailId === trail.id}
                    className="sr-only"
                    name="trailId"
                    onChange={() => setField('trailId', trail.id)}
                    type="radio"
                    value={trail.id}
                  />
                  <span className="font-bold text-[#173a2e]">{trail.name}</span>
                  <span className="mt-1 text-sm text-[#52675e]">
                    {formatMoney(trail.package.price)} package · up to{' '}
                    {trail.package.maximumParticipants} people
                  </span>
                  {(closures[trail.id] ?? []).length > 0 && (
                    <span className="mt-2 self-start rounded-full bg-[#fdf3dc] px-2 py-0.5 text-xs font-bold text-[#7a5300]">
                      Closed on some dates
                    </span>
                  )}
                </label>
              ))}
            </div>
            <p
              aria-live="polite"
              className="min-h-5 pt-1 text-sm text-rose-600"
              id="trailId-error"
            >
              {errors.trailId}
            </p>
          </fieldset>

          <fieldset className="rounded-2xl border border-[#d5e1da] bg-white p-6">
            <legend className="px-1 text-sm font-bold text-[#173a2e]">
              Schedule
            </legend>
            <div className="mt-2 grid gap-x-4 sm:grid-cols-2">
              <AuthFormField
                autoComplete="off"
                error={errors.scheduledDate}
                id="scheduledDate"
                label="Date"
                min={today}
                name="scheduledDate"
                onChange={(event) =>
                  setField('scheduledDate', event.target.value)
                }
                type="date"
                value={values.scheduledDate}
              />
              <AuthFormField
                autoComplete="off"
                error={errors.scheduledTime}
                id="scheduledTime"
                label="Start time"
                name="scheduledTime"
                onChange={(event) =>
                  setField('scheduledTime', event.target.value)
                }
                type="time"
                value={values.scheduledTime}
              />
            </div>
            {closureOnDate && selectedTrail && (
              <Alert
                className="mt-2"
                title={`${selectedTrail.name} is closed on this date`}
                tone="danger"
              >
                {formatDateRange(
                  closureOnDate.startDate,
                  closureOnDate.endDate,
                )}
                : {closureOnDate.reason}. Choose another date.
              </Alert>
            )}
            {!closureOnDate && (
              <DayForecastNote
                className="mt-2"
                date={values.scheduledDate}
                state={weather}
              />
            )}
          </fieldset>

          <fieldset className="rounded-2xl border border-[#d5e1da] bg-white p-6">
            <legend className="px-1 text-sm font-bold text-[#173a2e]">
              You (booking owner)
            </legend>
            <div className="mt-2">
              <AuthFormField
                autoComplete="name"
                hint="From your TrailSync profile."
                id="ownerName"
                label="Name"
                name="ownerName"
                onChange={() => {}}
                readOnly
                type="text"
                value={profile.fullName}
              />
            </div>
            <AuthFormField
              autoComplete="street-address"
              error={errors.ownerAddress}
              id="ownerAddress"
              label="Address"
              name="ownerAddress"
              onChange={(event) => setField('ownerAddress', event.target.value)}
              placeholder="City, province"
              type="text"
              value={values.ownerAddress}
            />
          </fieldset>

          <fieldset className="rounded-2xl border border-[#d5e1da] bg-white p-6">
            <legend className="px-1 text-sm font-bold text-[#173a2e]">
              Other participants
            </legend>
            <p className="mt-1 text-sm text-[#52675e]">
              Optional. Add up to {maxAdditional} more{' '}
              {maxAdditional === 1 ? 'person' : 'people'}, each{' '}
              {MIN_PARTICIPANT_AGE} or older.
            </p>
            {values.additionalParticipants.map((person, index) => {
              const prefix = `additionalParticipants.${index}`
              return (
                <div
                  className="mt-5 border-t border-[#e7ece8] pt-4"
                  key={index}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-[#173a2e]">
                      Participant {index + 2}
                    </p>
                    <button
                      className="text-sm font-bold text-[#007e4f] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]"
                      onClick={() => removeParticipant(index)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-x-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                    <AuthFormField
                      autoComplete="off"
                      error={errors[`${prefix}.name`]}
                      id={`participant-${index}-name`}
                      label="Name"
                      name={`${prefix}.name`}
                      onChange={(event) =>
                        setParticipantField(index, 'name', event.target.value)
                      }
                      type="text"
                      value={person.name}
                    />
                    <AuthFormField
                      autoComplete="off"
                      error={errors[`${prefix}.age`]}
                      id={`participant-${index}-age`}
                      inputMode="numeric"
                      label="Age"
                      name={`${prefix}.age`}
                      onChange={(event) =>
                        setParticipantField(index, 'age', event.target.value)
                      }
                      type="text"
                      value={person.age}
                    />
                  </div>
                  <AuthFormField
                    autoComplete="off"
                    error={errors[`${prefix}.address`]}
                    id={`participant-${index}-address`}
                    label="Address"
                    name={`${prefix}.address`}
                    onChange={(event) =>
                      setParticipantField(index, 'address', event.target.value)
                    }
                    type="text"
                    value={person.address}
                  />
                  <AuthFormField
                    autoComplete="off"
                    error={errors[`${prefix}.email`]}
                    id={`participant-${index}-email`}
                    label="Email for their certificate (optional)"
                    name={`${prefix}.email`}
                    onChange={(event) =>
                      setParticipantField(index, 'email', event.target.value)
                    }
                    type="email"
                    value={person.email}
                  />
                </div>
              )
            })}
            <p
              aria-live="polite"
              className="min-h-5 pt-1 text-sm text-rose-600"
            >
              {errors.additionalParticipants}
            </p>
            <button
              className={`mt-1 ${secondaryButtonClass}`}
              disabled={values.additionalParticipants.length >= maxAdditional}
              onClick={addParticipant}
              type="button"
            >
              Add participant
            </button>
          </fieldset>

          <fieldset
            aria-describedby="paymentOption-error"
            className="rounded-2xl border border-[#d5e1da] bg-white p-6"
          >
            <legend className="px-1 text-sm font-bold text-[#173a2e]">
              Payment
            </legend>
            {selectedTrail ? (
              <>
                <p className="mt-1 text-sm text-[#52675e]">
                  Pay the {selectedTrail.paymentRequirement.downpaymentPercent}%
                  downpayment now and the rest in cash at check-in, or pay the
                  full package now.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        option: 'DOWNPAYMENT',
                        title: `${selectedTrail.paymentRequirement.downpaymentPercent}% downpayment`,
                        amount: selectedTrail.paymentRequirement.amount,
                        note: `${formatMoney({ amount: selectedTrail.package.price.amount - selectedTrail.paymentRequirement.amount, currency: selectedTrail.package.price.currency })} cash balance at check-in`,
                      },
                      {
                        option: 'FULL',
                        title: 'Full payment',
                        amount: selectedTrail.paymentRequirement.fullAmount,
                        note: 'Nothing to pay at check-in',
                      },
                    ] as const
                  ).map((choice) => (
                    <label
                      className={`flex cursor-pointer flex-col rounded-xl border p-4 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#008755] ${values.paymentOption === choice.option ? 'border-[#008755] bg-[#f1f8f4]' : 'border-[#c8d7cf] hover:bg-[#f7faf8]'}`}
                      key={choice.option}
                    >
                      <input
                        checked={values.paymentOption === choice.option}
                        className="sr-only"
                        name="paymentOption"
                        onChange={() =>
                          setField('paymentOption', choice.option)
                        }
                        type="radio"
                        value={choice.option}
                      />
                      <span className="font-bold text-[#173a2e]">
                        {choice.title}
                      </span>
                      <span className="mt-1 text-lg font-bold text-[#006b43]">
                        {formatMoney({
                          amount: choice.amount,
                          currency: selectedTrail.paymentRequirement.currency,
                        })}
                      </span>
                      <span className="mt-1 text-xs text-[#52675e]">
                        {choice.note}
                      </span>
                    </label>
                  ))}
                </div>
                <p
                  aria-live="polite"
                  className="min-h-5 pt-1 text-sm text-rose-600"
                  id="paymentOption-error"
                >
                  {errors.paymentOption}
                </p>
                {values.paymentOption && (
                  <div className="grid gap-4">
                    <GcashPaymentPanel
                      amount={{
                        amount: amountDueOnline(
                          selectedTrail,
                          values.paymentOption,
                        ),
                        currency: selectedTrail.paymentRequirement.currency,
                      }}
                      method={selectedTrail.paymentRequirement.method}
                    />
                    <ReceiptUploadField
                      onReceiptChange={(receipt) =>
                        updateValues({ ...values, receipt })
                      }
                      onReferenceNumberChange={(value) =>
                        setField('referenceNumber', value)
                      }
                      receipt={values.receipt}
                      receiptError={errors.receipt}
                      referenceNumber={values.referenceNumber}
                      referenceNumberError={errors.referenceNumber}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-[#52675e]">
                Select a trail to see the payment options.
              </p>
            )}
          </fieldset>
        </div>

        <aside className="rounded-2xl border border-[#d5e1da] bg-white p-6 lg:sticky lg:top-6">
          <h2 className="text-sm font-bold text-[#173a2e]">Summary</h2>
          {selectedTrail ? (
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[#70857b]">Trail</dt>
                <dd className="text-right font-semibold text-[#173a2e]">
                  {selectedTrail.name}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#70857b]">Group</dt>
                <dd className="font-semibold text-[#173a2e]">
                  {groupSize} of {maxParticipants}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-[#e7ece8] pt-3">
                <dt className="text-[#70857b]">Package price</dt>
                <dd className="font-semibold text-[#173a2e]">
                  {formatMoney(selectedTrail.package.price)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#70857b]">
                  {values.paymentOption === 'FULL'
                    ? 'Pay now by GCash'
                    : `Downpayment now (${selectedTrail.paymentRequirement.downpaymentPercent}%)`}
                </dt>
                <dd className="font-bold text-[#006b43]">
                  {formatMoney({
                    amount: amountDueOnline(
                      selectedTrail,
                      values.paymentOption || 'DOWNPAYMENT',
                    ),
                    currency: selectedTrail.paymentRequirement.currency,
                  })}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#70857b]">Cash at check-in</dt>
                <dd className="font-semibold text-[#173a2e]">
                  {formatMoney({
                    amount:
                      selectedTrail.package.price.amount -
                      amountDueOnline(
                        selectedTrail,
                        values.paymentOption || 'DOWNPAYMENT',
                      ),
                    currency: selectedTrail.package.price.currency,
                  })}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-[#52675e]">
              Select a trail to see the package price.
            </p>
          )}
          <p className="mt-4 text-xs leading-5 text-[#70857b]">
            A tourism coordinator checks your GCash receipt before confirming.
            If it can’t be verified, you’ll be asked to upload a new one. Your
            guide is assigned at check-in.
          </p>
          <div className="mt-4">
            <AgreementCheckbox
              checked={values.acceptedWaiver}
              error={errors.acceptedWaiver}
              id="accepted-waiver"
              name="acceptedWaiver"
              onChange={(event) =>
                updateValues({
                  ...values,
                  acceptedWaiver: event.target.checked,
                })
              }
            >
              {(link) => (
                <>
                  I have read the{' '}
                  {link('waiver', 'Trek Waiver and Trail Rules')}, and I confirm
                  every participant (or a parent or guardian of each minor)
                  agrees to them.
                </>
              )}
            </AgreementCheckbox>
          </div>
          <AuthSubmitButton isLoading={isSubmitting} label="Send booking" />
          <p
            aria-live="polite"
            className="min-h-5 pt-2 text-sm text-rose-600"
            role="alert"
          >
            {formError}
          </p>
          <Link
            className="text-sm font-bold text-[#007e4f] underline-offset-4 hover:underline"
            to="/trails"
          >
            Back to trails
          </Link>
        </aside>
      </form>
    </>
  )
}
