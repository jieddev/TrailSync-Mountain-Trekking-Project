import type { ApiErrorDetail } from '../../../lib/api'
import type {
  CreateBookingInput,
  PaymentOption,
  ScheduleInput,
} from '../../../lib/bookings-api'
import type { Money, Trail } from '../../../lib/trails-api'
import { WAIVER_VERSION } from '../../legal/agreements'

// Form values stay as strings so inputs remain controlled; they are converted
// to the API shape only on submit.
export type ParticipantFormValues = {
  name: string
  age: string
  address: string
  email: string
}

export type BookingFormValues = {
  trailId: string
  scheduledDate: string
  scheduledTime: string
  ownerAge: string
  ownerAddress: string
  additionalParticipants: ParticipantFormValues[]
  paymentOption: PaymentOption | ''
  receipt: File | null
  referenceNumber: string
  acceptedWaiver: boolean
}

export type ScheduleFormValues = ScheduleInput

// Keys: 'trailId', 'ownerAge', 'additionalParticipants.0.name', etc.
export type BookingFormErrors = Record<string, string>

// Must match MIN_BOOKING_OWNER_AGE in backend/src/lib/package-policy.ts.
// Only the person booking must be an adult; participants may be minors.
export const MIN_BOOKING_OWNER_AGE = 18

// Must match the receipt rules in backend/src/lib/receipt-upload.ts.
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024
export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// The screenshot is required; the GCash reference number is optional.
export function validateReceipt(
  receipt: File | null,
  referenceNumber: string,
): BookingFormErrors {
  const errors: BookingFormErrors = {}
  if (!receipt) {
    errors.receipt = 'Upload a screenshot of your GCash receipt.'
  } else if (!RECEIPT_TYPES.includes(receipt.type)) {
    errors.receipt = 'Upload a JPG, PNG or WebP image.'
  } else if (receipt.size > MAX_RECEIPT_BYTES) {
    errors.receipt = 'The screenshot must be 5 MB or smaller.'
  }
  const reference = referenceNumber.replace(/\s+/g, '')
  if (reference && !/^\d{13}$/.test(reference)) {
    errors.referenceNumber =
      'The GCash reference number has 13 digits. Leave it blank if you don’t have it.'
  }
  return errors
}

// What the hiker sends by GCash now for the chosen option.
export function amountDueOnline(trail: Trail, option: PaymentOption) {
  return option === 'FULL'
    ? trail.paymentRequirement.fullAmount
    : trail.paymentRequirement.amount
}

export const emptyParticipant: ParticipantFormValues = {
  name: '',
  age: '',
  address: '',
  email: '',
}

function isPositiveInteger(value: string) {
  return /^\d+$/.test(value.trim()) && Number(value) > 0
}

// Optional email for a participant's certificate: blank, or address-shaped.
export function isOptionalEmail(value: string) {
  return !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

// The date in the hiker's own timezone, as YYYY-MM-DD for <input type="date">.
export function todayLocalIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// Today's Asia/Manila date, used only to decide which actions to show; the API
// enforces the check-in date itself.
export function manilaTodayIso(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function validateSchedule(
  values: ScheduleFormValues,
  today = todayLocalIso(),
): BookingFormErrors {
  const errors: BookingFormErrors = {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.scheduledDate)) {
    errors.scheduledDate = 'Choose a date.'
  } else if (values.scheduledDate < today) {
    errors.scheduledDate = 'Choose today or a later date.'
  }
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(values.scheduledTime)) {
    errors.scheduledTime = 'Choose a time.'
  }
  return errors
}

export function validateBookingForm(
  values: BookingFormValues,
  maxAdditionalParticipants: number,
  today = todayLocalIso(),
): BookingFormErrors {
  const errors: BookingFormErrors = {}

  if (!values.trailId) errors.trailId = 'Select a trail.'
  Object.assign(errors, validateSchedule(values, today))
  if (!isPositiveInteger(values.ownerAge)) {
    errors.ownerAge = 'Enter your age as a whole number.'
  } else if (Number(values.ownerAge) < MIN_BOOKING_OWNER_AGE) {
    errors.ownerAge = `You must be ${MIN_BOOKING_OWNER_AGE} or older to book. Ask an adult in your group to book instead.`
  }
  if (!values.ownerAddress.trim()) errors.ownerAddress = 'Enter your address.'

  if (values.additionalParticipants.length > maxAdditionalParticipants) {
    errors.additionalParticipants = `You can add at most ${maxAdditionalParticipants} more participants.`
  }
  values.additionalParticipants.forEach((person, index) => {
    const prefix = `additionalParticipants.${index}`
    if (!person.name.trim()) errors[`${prefix}.name`] = 'Enter a name.'
    if (!isPositiveInteger(person.age)) {
      errors[`${prefix}.age`] = 'Enter the age as a whole number.'
    }
    if (!person.address.trim())
      errors[`${prefix}.address`] = 'Enter an address.'
    if (!isOptionalEmail(person.email))
      errors[`${prefix}.email`] = 'Enter a valid email or leave it blank.'
  })

  if (!values.paymentOption) {
    errors.paymentOption = 'Choose how much you will pay now.'
  }
  Object.assign(errors, validateReceipt(values.receipt, values.referenceNumber))

  if (!values.acceptedWaiver) {
    errors.acceptedWaiver = 'Agree to the Trek Waiver and Trail Rules to book.'
  }

  return errors
}

export function toCreateBookingInput(
  values: BookingFormValues,
): CreateBookingInput {
  return {
    trailId: values.trailId,
    scheduledDate: values.scheduledDate,
    scheduledTime: values.scheduledTime,
    ownerDetails: {
      age: Number(values.ownerAge),
      address: values.ownerAddress.trim(),
    },
    additionalParticipants: values.additionalParticipants.map((person) => ({
      name: person.name.trim(),
      age: Number(person.age),
      address: person.address.trim(),
      ...(person.email.trim() && { email: person.email.trim() }),
    })),
    paymentOption: values.paymentOption as PaymentOption,
    acceptedWaiverVersion: WAIVER_VERSION,
  }
}

const apiFieldToFormField: Record<string, string> = {
  'ownerDetails.age': 'ownerAge',
  'ownerDetails.address': 'ownerAddress',
  acceptedWaiverVersion: 'acceptedWaiver',
}

// Maps backend validation details onto form error keys. Backend messages are
// written for clients (see API_CONTRACT_V1.md), so they are safe to show.
export function fieldErrorsFromApi(
  details: ApiErrorDetail[],
): BookingFormErrors {
  const errors: BookingFormErrors = {}
  for (const detail of details) {
    const field = apiFieldToFormField[detail.field] ?? detail.field
    errors[field] ??= detail.message
  }
  return errors
}

export function formatMoney({ amount, currency }: Money) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatSchedule(scheduledDate: string, scheduledTime: string) {
  const [year, month, day] = scheduledDate.split('-').map(Number)
  const [hours, minutes] = scheduledTime.split(':').map(Number)
  const date = new Date(year, month - 1, day, hours, minutes)
  const datePart = new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
  const timePart = new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
  return `${datePart} · ${timePart}`
}

// "Mon, Oct 26, 2026" or "Mon, Oct 26 – Tue, Oct 27, 2026" for a closure range.
export function formatDateRange(startDate: string, endDate: string) {
  const toDate = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  const format = new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  if (startDate === endDate) return format.format(toDate(startDate))
  return format.formatRange(toDate(startDate), toDate(endDate))
}
