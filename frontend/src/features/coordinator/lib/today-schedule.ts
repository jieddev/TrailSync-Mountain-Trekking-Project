import type { Booking } from '../../../lib/bookings-api'
import type { DailyWeather } from '../../../lib/weather-api'

type ScheduleBooking = Pick<Booking, 'id' | 'status' | 'scheduledTime'>

// Today's groups by trek time (HH:mm sorts as text). Finished treks go last so
// the groups that still need the office stay at the top.
export function orderTodaySchedule<T extends ScheduleBooking>(bookings: T[]) {
  const byTime = (a: T, b: T) => a.scheduledTime.localeCompare(b.scheduledTime)
  return [
    ...bookings
      .filter((booking) => booking.status !== 'COMPLETED')
      .sort(byTime),
    ...bookings
      .filter((booking) => booking.status === 'COMPLETED')
      .sort(byTime),
  ]
}

// Where the coordinator goes next for a group on today's schedule.
export function scheduleAction(booking: ScheduleBooking) {
  const detail = `/coordinator/bookings/${booking.id}`
  switch (booking.status) {
    case 'PENDING_CONFIRMATION':
      return { label: 'Review', to: detail }
    case 'CONFIRMED':
      return { label: 'Check in', to: `${detail}/check-in` }
    case 'CHECKED_IN':
      return { label: 'Assign guide', to: '/coordinator/dispatch' }
    default:
      return { label: 'View', to: detail }
  }
}

const timeFormat = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

export function formatTrekTime(scheduledTime: string) {
  const [hours, minutes] = scheduledTime.split(':').map(Number)
  return timeFormat.format(new Date(2000, 0, 1, hours, minutes))
}

// Advisory only. Thunderstorms are the one signal the forecast flags itself;
// rain and wind thresholds are not decided, so they don't raise an alert.
export function todaysThunderstorm(
  daily: Pick<DailyWeather, 'date' | 'thunderstorm'>[],
  today: string,
) {
  return daily.find((day) => day.date === today)?.thunderstorm ?? false
}
