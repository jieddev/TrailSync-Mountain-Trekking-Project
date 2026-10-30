import {
  capitalize,
  conditionIconUrl,
  windKph,
  type DailyWeather,
} from '../../../lib/weather-api'
import { manilaTodayIso } from '../../booking/lib/booking-form'
import type { WeatherState } from '../lib/use-weather'

type WeatherCardProps = {
  state: WeatherState
  className?: string
  compact?: boolean
}

const dayFormat = new Intl.DateTimeFormat('en-PH', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})
const timeFormat = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  hour: 'numeric',
  minute: '2-digit',
})

function dayLabel(date: string) {
  if (date === manilaTodayIso()) return 'Today'
  const [year, month, day] = date.split('-').map(Number)
  return dayFormat.format(new Date(year, month - 1, day))
}

function DayRow({ day }: { day: DailyWeather }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <img
        alt=""
        className="-my-2 size-10 shrink-0"
        src={conditionIconUrl(day.condition)}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#173a2e]">
          {dayLabel(day.date)}
          {day.thunderstorm && (
            <span className="ml-2 rounded-full bg-[#fdf3dc] px-2 py-0.5 text-xs font-bold text-[#7a5300]">
              Thunderstorms
            </span>
          )}
        </p>
        <p className="text-xs text-[#52675e]">
          {capitalize(day.condition.description)} · {day.rainChancePercent}%
          rain ({day.rainMm} mm) · wind up to{' '}
          {windKph(day.maxWindGustMs ?? day.maxWindSpeedMs)} km/h
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold text-[#173a2e]">
        {Math.round(day.minTemperatureC)}–{Math.round(day.maxTemperatureC)}°C
      </p>
    </li>
  )
}

// One short line per day for the compact card.
function CompactDayRow({ day }: { day: DailyWeather }) {
  return (
    <li className="flex items-center gap-2 py-1.5 text-sm">
      <span className="w-16 shrink-0 font-semibold text-[#173a2e]">
        {dayLabel(day.date)}
      </span>
      <img
        alt={capitalize(day.condition.description)}
        className="-my-2 size-9 shrink-0"
        src={conditionIconUrl(day.condition)}
        title={capitalize(day.condition.description)}
      />
      <span className="flex-1 text-xs text-[#52675e]">
        {day.rainChancePercent}% rain
        {day.thunderstorm && (
          <span className="ml-1.5 rounded-full bg-[#fdf3dc] px-1.5 py-0.5 font-bold text-[#7a5300]">
            Storms
          </span>
        )}
      </span>
      <span className="shrink-0 font-semibold text-[#173a2e]">
        {Math.round(day.minTemperatureC)}–{Math.round(day.maxTemperatureC)}°
      </span>
    </li>
  )
}

// Current conditions and the coming days at the trail point. Advisory only:
// trails are closed by a coordinator, never by the forecast. The compact
// variant fits a narrow side column and shows only the next three days.
export default function WeatherCard({
  state,
  className = '',
  compact = false,
}: WeatherCardProps) {
  return (
    <section
      aria-labelledby="weather-title"
      className={`rounded-2xl border border-[#d5e1da] bg-white p-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="weather-title" className="text-sm font-bold text-[#173a2e]">
            Trail weather
          </h2>
          {state.status === 'loaded' && (
            <p className="mt-1 text-xs text-[#70857b]">
              {state.weather.location.name}
              {state.weather.location.provisional && ' (approximate point)'}
            </p>
          )}
        </div>
        <span className="rounded-full bg-[#e8f1eb] px-3 py-1 text-xs font-bold text-[#006b43]">
          Advisory
        </span>
      </div>

      {state.status === 'loading' && (
        <p className="mt-4 text-sm text-[#52675e]" role="status">
          Loading the weather…
        </p>
      )}
      {state.status === 'unavailable' && (
        <p className="mt-4 text-sm text-[#52675e]">
          Weather isn’t available right now. Please check again later.
        </p>
      )}
      {state.status === 'loaded' && compact && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <img
              alt=""
              className="-my-2 size-14 shrink-0"
              src={conditionIconUrl(state.weather.current.condition)}
            />
            <div>
              <p className="text-3xl font-bold text-[#002d20]">
                {Math.round(state.weather.current.temperatureC)}°C
              </p>
              <p className="text-sm text-[#52675e]">
                {capitalize(state.weather.current.condition.description)} ·
                feels like {Math.round(state.weather.current.feelsLikeC)}°C
              </p>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-[#e7ece8] border-t border-[#e7ece8]">
            {state.weather.daily.slice(0, 3).map((day) => (
              <CompactDayRow day={day} key={day.date} />
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-[#70857b]">
            {state.weather.stale ? 'May be out of date · ' : ''}
            Updated {timeFormat.format(new Date(state.weather.fetchedAt))}.
            Coordinators close trails when conditions are unsafe.
          </p>
        </>
      )}
      {state.status === 'loaded' && !compact && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <img
              alt=""
              className="-my-2 size-14 shrink-0"
              src={conditionIconUrl(state.weather.current.condition)}
            />
            <div>
              <p className="text-3xl font-bold text-[#002d20]">
                {Math.round(state.weather.current.temperatureC)}°C
              </p>
              <p className="text-sm text-[#52675e]">
                {capitalize(state.weather.current.condition.description)} ·
                feels like {Math.round(state.weather.current.feelsLikeC)}°C ·
                humidity {state.weather.current.humidityPercent}% · wind{' '}
                {windKph(state.weather.current.windSpeedMs)} km/h
              </p>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-[#e7ece8] border-t border-[#e7ece8]">
            {state.weather.daily.map((day) => (
              <DayRow day={day} key={day.date} />
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-[#70857b]">
            {state.weather.stale
              ? 'We couldn’t refresh the weather, so this may be out of date. '
              : ''}
            Updated {timeFormat.format(new Date(state.weather.fetchedAt))} from
            OpenWeather. Weather is advisory: a coordinator closes a trail when
            conditions are unsafe.
          </p>
        </>
      )}
    </section>
  )
}
