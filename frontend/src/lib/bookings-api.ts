import { fetchBlob, requestForm, requestJson } from './api'
import type {
  PaymentMethod,
  PaymentRequirement,
  TrailPackage,
} from './trails-api'

export type BookingStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'GUIDE_ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
// The status of the GCash payment as a whole (downpayment or full).
// REJECTED: the coordinator rejected the latest receipt; upload a new one.
export type DownpaymentStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED'

// DOWNPAYMENT: 50% by GCash now, the rest in cash at check-in.
export type PaymentOption = 'DOWNPAYMENT' | 'FULL'

export type ReceiptStatus = 'SUBMITTED' | 'ACCEPTED' | 'REJECTED'

export type PaymentReceipt = {
  id: string
  amount: number
  referenceNumber: string | null
  status: ReceiptStatus
  rejectionReason: string | null
  reviewedAt: string | null
  createdAt: string
}

// Snapshotted on the booking; entrance is the total for the booked group.
export type BookingFees = {
  garbage: number
  environmental: number
  entrance: number
}

export type BookingPayment = {
  option: PaymentOption
  currency: string
  fees: BookingFees
  totalAmount: number
  amountDueOnline: number
  balanceDueOnSite: number
  balanceCollectedAt: string | null
  method: PaymentMethod
  // Newest first.
  receipts: PaymentReceipt[]
}

export type BookingParticipant = {
  id: string
  kind: 'BOOKING_OWNER' | 'ADDITIONAL_PARTICIPANT' | 'WALK_IN'
  name: string
  age: number
  address: string
  // Where the certificate goes; null sends it to the booking owner.
  email: string | null
  // Recorded at check-in; null before the group checks in.
  attendance: 'PRESENT' | 'ABSENT' | null
  // When the completion certificate was emailed.
  certificateSentAt: string | null
}

export type Booking = {
  id: string
  trail: { id: string; name: string }
  scheduledDate: string
  scheduledTime: string
  status: BookingStatus
  downpaymentStatus: DownpaymentStatus
  participants: BookingParticipant[]
  participantCount: number
  guide: { id: string; fullName: string } | null
  checkedInAt: string | null
  guideAssignedAt: string | null
  // Set when the guide starts the trek from the guide app.
  trekStartedAt: string | null
  completedAt: string | null
  package: TrailPackage
  paymentRequirement: PaymentRequirement
  payment: BookingPayment
  // The coordinator's closure of this trail on the booking's date, if any.
  trailRestriction: BookingTrailRestriction | null
  createdAt: string
  updatedAt: string
}

export type BookingTrailRestriction = {
  startDate: string
  endDate: string
  reason: string
}

export type ParticipantInput = {
  name: string
  age: number
  address: string
  email?: string
}

export type CreateBookingInput = {
  trailId: string
  scheduledDate: string
  scheduledTime: string
  // The owner's name and age come from their profile.
  ownerDetails: { address: string }
  additionalParticipants: ParticipantInput[]
  paymentOption: PaymentOption
  // The Trek Waiver version the owner agreed to for the whole group.
  acceptedWaiverVersion: string
}

export type ScheduleInput = { scheduledDate: string; scheduledTime: string }

const bookingPath = (bookingId: string) =>
  `/api/v1/bookings/${encodeURIComponent(bookingId)}`

export type ReceiptInput = {
  receipt: File
  // Optional 13-digit GCash reference number.
  referenceNumber?: string
}

function receiptForm({ receipt, referenceNumber }: ReceiptInput) {
  const form = new FormData()
  form.append('receipt', receipt)
  if (referenceNumber?.trim())
    form.append('referenceNumber', referenceNumber.trim())
  return form
}

// The booking details go as JSON in the "booking" field next to the
// screenshot, so a booking is never created without its receipt.
export function createBooking(
  idToken: string,
  input: CreateBookingInput,
  payment: ReceiptInput,
) {
  const form = receiptForm(payment)
  form.append('booking', JSON.stringify(input))
  return requestForm<Booking>(
    '/api/v1/bookings',
    { idToken, form },
    'Could not create your booking.',
  )
}

// Allowed only after the coordinator rejected the last receipt.
export function uploadPaymentReceipt(
  idToken: string,
  bookingId: string,
  payment: ReceiptInput,
) {
  return requestForm<Booking>(
    `${bookingPath(bookingId)}/payment-receipt`,
    { idToken, form: receiptForm(payment) },
    'Could not upload your receipt.',
  )
}

export function getReceiptImage(
  idToken: string,
  bookingId: string,
  receiptId: string,
) {
  return fetchBlob(
    `${bookingPath(bookingId)}/payment-receipts/${encodeURIComponent(receiptId)}/file`,
    idToken,
    'Could not load the receipt image.',
  )
}

export async function listBookings(idToken: string) {
  const { items } = await requestJson<{ items: Booking[] }>(
    '/api/v1/bookings',
    { idToken },
    'Could not load your bookings.',
  )
  return items
}

export function getBooking(idToken: string, bookingId: string) {
  return requestJson<Booking>(
    bookingPath(bookingId),
    { idToken },
    'Could not load this booking.',
  )
}

export function rescheduleBooking(
  idToken: string,
  bookingId: string,
  schedule: ScheduleInput,
) {
  return requestJson<Booking>(
    `${bookingPath(bookingId)}/reschedule`,
    { idToken, method: 'POST', body: schedule },
    'Could not reschedule your booking.',
  )
}
