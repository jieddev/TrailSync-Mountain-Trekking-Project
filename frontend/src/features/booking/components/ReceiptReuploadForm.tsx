import type { FormEvent } from 'react'
import { useState } from 'react'

import { useAuth } from '../../../app/AuthContext'
import { ApiError } from '../../../lib/api'
import { type Booking, uploadPaymentReceipt } from '../../../lib/bookings-api'
import AuthSubmitButton from '../../auth/components/AuthSubmitButton'
import {
  type BookingFormErrors,
  fieldErrorsFromApi,
  validateReceipt,
} from '../lib/booking-form'
import GcashPaymentPanel from './GcashPaymentPanel'
import ReceiptUploadField from './ReceiptUploadField'

type ReceiptReuploadFormProps = {
  booking: Booking
  onUploaded: (booking: Booking) => void
}

// Shown after the coordinator rejects a receipt: pay (if needed) and upload again.
export default function ReceiptReuploadForm({
  booking,
  onUploaded,
}: ReceiptReuploadFormProps) {
  const { user } = useAuth()
  const [receipt, setReceipt] = useState<File | null>(null)
  const [referenceNumber, setReferenceNumber] = useState('')
  const [errors, setErrors] = useState<BookingFormErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const validationErrors = validateReceipt(receipt, referenceNumber)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setIsSubmitting(true)
    try {
      const idToken = await user!.getIdToken()
      onUploaded(
        await uploadPaymentReceipt(idToken, booking.id, {
          receipt: receipt!,
          referenceNumber,
        }),
      )
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setErrors(fieldErrorsFromApi(error.details))
      } else if (
        error instanceof ApiError &&
        error.code === 'RECEIPT_UPLOAD_NOT_ALLOWED'
      ) {
        setFormError(
          'This booking isn’t waiting for a new receipt. Refresh the page to see its status.',
        )
      } else {
        setFormError('We couldn’t upload your receipt. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
      <GcashPaymentPanel
        amount={{
          amount: booking.payment.amountDueOnline,
          currency: booking.payment.currency,
        }}
        method={booking.payment.method}
      />
      <ReceiptUploadField
        idPrefix="reupload"
        onReceiptChange={setReceipt}
        onReferenceNumberChange={setReferenceNumber}
        receipt={receipt}
        receiptError={errors.receipt}
        referenceNumber={referenceNumber}
        referenceNumberError={errors.referenceNumber}
      />
      <div>
        <AuthSubmitButton isLoading={isSubmitting} label="Upload new receipt" />
        <p
          aria-live="polite"
          className="min-h-5 pt-2 text-sm text-rose-600"
          role="alert"
        >
          {formError}
        </p>
      </div>
    </form>
  )
}
