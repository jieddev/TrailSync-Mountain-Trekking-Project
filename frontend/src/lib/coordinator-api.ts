import { fetchBlob, requestJson } from './api'
import type {
  Booking,
  BookingStatus,
  DownpaymentStatus,
  ParticipantInput,
} from './bookings-api'

export type CoordinatorBooking = Booking & {
  owner: { id: string; fullName: string; email: string }
}

const coordinatorBookingsPath = '/api/v1/coordinator/bookings'

// `today` limits the list to bookings scheduled for today in Asia/Manila;
// `downpaymentStatus` to bookings whose GCash payment is in one of these states.
export async function listCoordinatorBookings(
  idToken: string,
  status?: BookingStatus,
  {
    today = false,
    downpaymentStatus,
  }: { today?: boolean; downpaymentStatus?: DownpaymentStatus[] } = {},
) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (today) params.set('today', 'true')
  if (downpaymentStatus?.length) {
    params.set('downpaymentStatus', downpaymentStatus.join(','))
  }
  const query = params.toString() ? `?${params}` : ''
  const { items } = await requestJson<{ items: CoordinatorBooking[] }>(
    `${coordinatorBookingsPath}${query}`,
    { idToken },
    'Could not load the booking queue.',
  )
  return items
}

// Counts for the dashboard and navigation badges (API_CONTRACT_V1.md §12).
export type CoordinatorSummary = {
  bookings: {
    needsReview: number
    waitingOnHiker: number
    upcoming: number
    arrivingToday: number
    completed: number
  }
  dispatch: { waitingForGuide: number; onTrail: number }
  guides: {
    available: number
    onTrek: number
    nextUp: { id: string; fullName: string } | null
  }
  guideApplications: { pending: number }
  incidents: { open: number }
  trailRestrictions: { active: number }
}

export function getCoordinatorSummary(idToken: string) {
  return requestJson<CoordinatorSummary>(
    '/api/v1/coordinator/summary',
    { idToken },
    'Could not load the coordinator summary.',
  )
}

export function getCoordinatorBooking(idToken: string, bookingId: string) {
  return requestJson<CoordinatorBooking>(
    `${coordinatorBookingsPath}/${encodeURIComponent(bookingId)}`,
    { idToken },
    'Could not load this booking.',
  )
}

export type GuideApplicationStatus = 'PENDING' | 'APPROVED' | 'DECLINED'

export type GuideApplication = {
  id: string
  fullName: string
  email: string
  status: GuideApplicationStatus
  declineReason: string | null
  reviewedAt: string | null
  reviewedBy: { id: string; fullName: string } | null
  createdAt: string
}

const guideApplicationsPath = '/api/v1/coordinator/guide-applications'

export async function listGuideApplications(
  idToken: string,
  status?: GuideApplicationStatus,
) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  const { items } = await requestJson<{ items: GuideApplication[] }>(
    `${guideApplicationsPath}${query}`,
    { idToken },
    'Could not load guide account requests.',
  )
  return items
}

// Approving creates the guide's TrailSync account.
export function approveGuideApplication(
  idToken: string,
  applicationId: string,
) {
  return requestJson<GuideApplication>(
    `${guideApplicationsPath}/${encodeURIComponent(applicationId)}/approve`,
    { idToken, method: 'POST' },
    'Could not approve this request.',
  )
}

export function declineGuideApplication(
  idToken: string,
  applicationId: string,
  reason?: string,
) {
  return requestJson<GuideApplication>(
    `${guideApplicationsPath}/${encodeURIComponent(applicationId)}/decline`,
    { idToken, method: 'POST', body: reason ? { reason } : {} },
    'Could not decline this request.',
  )
}

// The confirm endpoint returns the plain booking representation (no owner).
export function confirmBooking(idToken: string, bookingId: string) {
  return requestJson<Booking>(
    `/api/v1/bookings/${encodeURIComponent(bookingId)}/confirm`,
    { idToken, method: 'POST' },
    'Could not confirm this booking.',
  )
}

const bookingActionPath = (bookingId: string, action: string) =>
  `${coordinatorBookingsPath}/${encodeURIComponent(bookingId)}/${action}`

export type CheckInInput = {
  attendance: { participantId: string; present: boolean }[]
  walkIns: ParticipantInput[]
  // Required for 50% bookings: the cash balance was received at the desk.
  balanceCollected?: boolean
}

// The hiker can then upload a new screenshot; the booking stays pending.
export function rejectPayment(
  idToken: string,
  bookingId: string,
  reason: string,
) {
  return requestJson<CoordinatorBooking>(
    bookingActionPath(bookingId, 'payment/reject'),
    { idToken, method: 'POST', body: { reason } },
    'Could not reject this payment.',
  )
}

export function getCoordinatorReceiptImage(
  idToken: string,
  bookingId: string,
  receiptId: string,
) {
  return fetchBlob(
    bookingActionPath(
      bookingId,
      `payment-receipts/${encodeURIComponent(receiptId)}/file`,
    ),
    idToken,
    'Could not load the receipt image.',
  )
}

// Checks the group in and, in the same step, assigns the guide at the front of
// the queue. With no guide available the booking stays CHECKED_IN.
export function checkInBooking(
  idToken: string,
  bookingId: string,
  input: CheckInInput,
) {
  return requestJson<CoordinatorBooking>(
    bookingActionPath(bookingId, 'check-in'),
    { idToken, method: 'POST', body: input },
    'Could not check in this group.',
  )
}

export function assignNextGuide(idToken: string, bookingId: string) {
  return requestJson<CoordinatorBooking>(
    bookingActionPath(bookingId, 'assign-guide'),
    { idToken, method: 'POST' },
    'Could not assign a guide.',
  )
}

export function completeTrek(idToken: string, bookingId: string) {
  return requestJson<CoordinatorBooking>(
    bookingActionPath(bookingId, 'complete'),
    { idToken, method: 'POST' },
    'Could not complete this trek.',
  )
}

// Emails the certificates of a completed trek that haven't been sent yet.
export function resendCertificates(idToken: string, bookingId: string) {
  return requestJson<{ sent: number; booking: CoordinatorBooking }>(
    bookingActionPath(bookingId, 'certificates/resend'),
    { idToken, method: 'POST' },
    'Could not resend the certificates.',
  )
}

export type GuideDutyStatus = 'OFF_DUTY' | 'AVAILABLE' | 'ASSIGNED'

export type Guide = {
  id: string
  fullName: string
  email: string
  dutyStatus: GuideDutyStatus
  availableSince: string | null
  // 1 is the front of the FIFO queue; null unless the guide is AVAILABLE.
  queuePosition: number | null
  currentBooking: {
    id: string
    trail: { id: string; name: string }
    scheduledDate: string
    scheduledTime: string
  } | null
}

const guidesPath = '/api/v1/coordinator/guides'

// The queue first (front first), then guides on a trek, then off-duty guides.
export async function listGuides(idToken: string) {
  const { items } = await requestJson<{ items: Guide[] }>(
    guidesPath,
    { idToken },
    'Could not load guides.',
  )
  return items
}

export function setGuideAvailability(
  idToken: string,
  guideId: string,
  status: 'AVAILABLE' | 'OFF_DUTY',
) {
  return requestJson<Guide>(
    `${guidesPath}/${encodeURIComponent(guideId)}/availability`,
    { idToken, method: 'POST', body: { status } },
    'Could not update this guide.',
  )
}
