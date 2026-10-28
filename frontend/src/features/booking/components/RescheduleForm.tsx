import type { FormEvent } from 'react'
import { useState } from 'react'

import { useAuth } from '../../../app/AuthContext'
import { ApiError } from '../../../lib/api'
import { rescheduleBooking, type Booking } from '../../../lib/bookings-api'
import AuthFormField from '../../auth/components/AuthFormField'
import AuthSubmitButton from '../../auth/components/AuthSubmitButton'
import {
  type BookingFormErrors,
  type ScheduleFormValues,
  fieldErrorsFromApi,
  todayLocalIso,
  validateSchedule,
} from '../lib/booking-form'

type RescheduleFormProps = {
  booking: Booking
  onRescheduled: (booking: Booking) => void
}

export default function RescheduleForm({
  booking,
  onRescheduled,
}: RescheduleFormProps) {
  const { user } = useAuth()
  const [values, setValues] = useState<ScheduleFormValues>({
    scheduledDate: '',
    scheduledTime: booking.scheduledTime,
  })
  const [errors, setErrors] = useState<BookingFormErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const today = todayLocalIso()

  function setField(name: keyof ScheduleFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const validationErrors = validateSchedule(values, today)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setIsSubmitting(true)
    try {
      const idToken = await user!.getIdToken()
      onRescheduled(await rescheduleBooking(idToken, booking.id, values))
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setErrors(fieldErrorsFromApi(error.details))
      } else if (
        error instanceof ApiError &&
        error.code === 'TRAIL_RESTRICTED'
      ) {
        setErrors({
          scheduledDate:
            'This trail is closed on this date. Choose another date.',
        })
      } else if (
        error instanceof ApiError &&
        error.code === 'RESCHEDULE_NOT_ALLOWED'
      ) {
        setFormError(
          'This booking can’t be rescheduled right now. Only confirmed bookings can be moved.',
        )
      } else {
        setFormError('We couldn’t reschedule your booking. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section
      aria-labelledby="reschedule-title"
      className="rounded-2xl border border-[#d5e1da] bg-white p-6"
    >
      <h2 id="reschedule-title" className="text-sm font-bold text-[#173a2e]">
        Reschedule
      </h2>
      <p className="mt-1 text-sm leading-6 text-[#52675e]">
        Your trail, participants, and downpayment credit stay the same. The new
        schedule goes back to a coordinator for confirmation.
      </p>
      <form className="mt-4" noValidate onSubmit={handleSubmit}>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <AuthFormField
            autoComplete="off"
            error={errors.scheduledDate}
            id="rescheduleDate"
            label="New date"
            min={today}
            name="scheduledDate"
            onChange={(event) => setField('scheduledDate', event.target.value)}
            type="date"
            value={values.scheduledDate}
          />
          <AuthFormField
            autoComplete="off"
            error={errors.scheduledTime}
            id="rescheduleTime"
            label="New start time"
            name="scheduledTime"
            onChange={(event) => setField('scheduledTime', event.target.value)}
            type="time"
            value={values.scheduledTime}
          />
        </div>
        <AuthSubmitButton
          isLoading={isSubmitting}
          label="Request new schedule"
        />
        <p className="min-h-5 pt-2 text-sm text-rose-600" role="alert">
          {formError}
        </p>
      </form>
    </section>
  )
}
