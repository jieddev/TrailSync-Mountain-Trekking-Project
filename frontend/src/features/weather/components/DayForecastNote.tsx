import { describeDay, forecastOn } from '../../../lib/weather-api'
import Alert from '../../booking/components/Alert'
import type { WeatherState } from '../lib/use-weather'

type DayForecastNoteProps = {
  state: WeatherState
  date: string
  className?: string
}

// The forecast for one chosen date. Shows nothing until a date is picked or
// when there is no weather; dates past the forecast get a short hint.
export default function DayForecastNote({
  state,
  date,
  className = '',
}: DayForecastNoteProps) {
  if (!date || state.status !== 'loaded') return null
  const day = forecastOn(state.weather, date)

  if (!day) {
    // Before the first forecast day: today's last forecast hours have passed.
    if (date < (state.weather.daily[0]?.date ?? '')) return null
    return (
      <p className={`text-xs leading-5 text-[#70857b] ${className}`}>
        The weather forecast covers the next five days. Check back closer to
        your trek.
      </p>
    )
  }

  if (day.thunderstorm) {
    return (
      <Alert
        className={className}
        title="Thunderstorms forecast on this date"
        tone="warning"
      >
        {describeDay(day)}. This is advisory: the trail stays open unless a
        coordinator closes it, but consider another date.
      </Alert>
    )
  }

  return (
    <p className={`text-xs leading-5 text-[#52675e] ${className}`}>
      <span className="font-bold text-[#173a2e]">Forecast (advisory):</span>{' '}
      {describeDay(day)}.
    </p>
  )
}
