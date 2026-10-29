import type { Booking } from '../../../lib/bookings-api'

type TrekSchedule = Pick<Booking, 'status' | 'scheduledDate' | 'scheduledTime'>

// The booking the hiker most needs to see on the home page: a trek on the trail
// right now, otherwise the earliest one that isn't completed yet.
export function pickNextTrek<T extends TrekSchedule>(bookings: T[]): T | null {
  const active = bookings.filter((booking) => booking.status !== 'COMPLETED')
  const onTrail = active.find((booking) => booking.status === 'IN_PROGRESS')
  if (onTrail) return onTrail

  const scheduleKey = (booking: T) =>
    `${booking.scheduledDate}T${booking.scheduledTime}`
  return active.reduce<T | null>(
    (next, booking) =>
      next === null || scheduleKey(booking) < scheduleKey(next)
        ? booking
        : next,
    null,
  )
}
