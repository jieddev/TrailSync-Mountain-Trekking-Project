import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { listTrails, type Trail } from '../../../lib/trails-api'
import { formatMoney } from '../../booking/lib/booking-form'
import WeatherCard from '../../weather/components/WeatherCard'
import { useWeather } from '../../weather/lib/use-weather'
import NextTrekCard from '../components/NextTrekCard'
import TrailPreviewMap from '../components/TrailPreviewMap'
import { useHikerProfile } from '../hiker-profile'
import { TRAIL_PREVIEWS } from '../trail-previews'

const primaryLinkClass =
  'inline-flex rounded-lg bg-[#477a69] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#3a6457] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] focus-visible:ring-offset-2'
const secondaryLinkClass =
  'inline-flex rounded-lg border border-[#d5e1da] bg-white px-5 py-2.5 text-sm font-bold text-[#173a2e] hover:bg-[#f3f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] focus-visible:ring-offset-2'

function greeting(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now),
  )
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HikerHomePage() {
  const profile = useHikerProfile()
  const weather = useWeather()
  const [previewId, setPreviewId] = useState(TRAIL_PREVIEWS[0].id)
  const [trails, setTrails] = useState<Trail[]>([])
  const preview =
    TRAIL_PREVIEWS.find((trail) => trail.id === previewId) ?? TRAIL_PREVIEWS[0]
  const trail = trails.find((item) => item.slug === preview.id)
  // Older accounts only have fullName, so fall back to its first word.
  const firstName = profile.firstName ?? profile.fullName.trim().split(/\s+/)[0]

  useEffect(() => {
    let isCurrent = true
    // Only adds the price and a direct booking link, so failures stay quiet.
    listTrails()
      .then((items) => {
        if (isCurrent) setTrails(items)
      })
      .catch(() => {})
    return () => {
      isCurrent = false
    }
  }, [])

  return (
    <>
      <section
        aria-labelledby="welcome-title"
        className="flex flex-wrap items-end justify-between gap-6"
      >
        <div>
          <h1
            id="welcome-title"
            className="font-serif text-4xl font-bold leading-tight tracking-[-0.045em] text-[#002d20] sm:text-5xl"
          >
            {greeting()}, {firstName}
          </h1>
          <p className="mt-2 max-w-xl text-base leading-7 text-[#52675e]">
            Plan your next climb, check on your bookings, and see how the
            mountain looks today.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className={primaryLinkClass} to="/trails">
            Book a trek
          </Link>
          <Link className={secondaryLinkClass} to="/bookings">
            My bookings
          </Link>
        </div>
      </section>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section
          aria-labelledby="explore-title"
          className="rounded-2xl border border-[#d5e1da] bg-white p-4 sm:p-6"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2
              id="explore-title"
              className="font-serif text-2xl font-bold tracking-[-0.03em] text-[#002d20]"
            >
              Explore the trails
            </h2>
            <div
              aria-label="Trail to preview"
              className="flex max-w-full overflow-x-auto rounded-xl border border-[#d5e1da] bg-white p-1"
              role="group"
            >
              {TRAIL_PREVIEWS.map((item) => (
                <button
                  aria-pressed={item.id === preview.id}
                  className={`shrink-0 cursor-pointer rounded-lg px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] ${item.id === preview.id ? 'bg-[#477a69] text-white' : 'text-[#52675e] hover:bg-[#f3f6f2]'}`}
                  key={item.id}
                  onClick={() => setPreviewId(item.id)}
                  type="button"
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
          <TrailPreviewMap preview={preview} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-bold text-[#173a2e]">
                {preview.name}
              </p>
              <p className="mt-0.5 text-sm text-[#52675e]">
                {preview.subtitle} · 3D terrain preview
                {trail && (
                  <>
                    {' · '}
                    <span className="font-semibold text-[#173a2e]">
                      {formatMoney(trail.package.price)}
                    </span>{' '}
                    per group
                  </>
                )}
              </p>
            </div>
            <Link
              className={primaryLinkClass}
              to={
                trail
                  ? `/bookings/new?trailId=${encodeURIComponent(trail.id)}`
                  : '/trails'
              }
            >
              Book this trail
            </Link>
          </div>
        </section>

        <div className="grid gap-6">
          <NextTrekCard />
          <WeatherCard compact state={weather} />
        </div>
      </div>
    </>
  )
}
