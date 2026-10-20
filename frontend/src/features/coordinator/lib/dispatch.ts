import { ApiError } from '../../../lib/api'

export type Notice = { tone: 'success' | 'error'; text: string }

// Coordinator wording for the check-in and dispatch refusals in API_CONTRACT_V1.md.
const refusalMessages: Record<string, string> = {
  BOOKING_NOT_FOUND: 'This booking no longer exists.',
  CHECK_IN_NOT_ALLOWED:
    'This booking can no longer be checked in. Showing its latest status.',
  NOT_SCHEDULED_TODAY:
    'This booking isn’t scheduled for today. The group must reschedule before checking in.',
  BOOKING_NOT_WAITING:
    'This group is no longer waiting for a guide. Showing its latest status.',
  NO_GUIDE_AVAILABLE:
    'No guide is available yet. Mark a guide available in the guide queue, then try again.',
  BOOKING_NOT_ON_TREK:
    'This trek was already completed. Showing its latest status.',
  GUIDE_ON_TREK:
    'This guide is on an assigned trek. Complete the trek before changing their availability.',
  GUIDE_NOT_FOUND: 'This guide no longer exists.',
}

export function dispatchErrorMessage(error: unknown, fallback: string) {
  return (
    (error instanceof ApiError && error.code && refusalMessages[error.code]) ||
    fallback
  )
}

// Refusals caused by stale data on screen, so the page should reload.
export function isStaleRefusal(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code !== 'NO_GUIDE_AVAILABLE'
  )
}

export function formatClockTime(iso: string) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}
