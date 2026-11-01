import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import { listLiveTreks, type LiveTrek } from '../../../lib/live-treks-api'
import PageHeader from '../../booking/components/PageHeader'
import StatusCard from '../../booking/components/StatusCard'
import LiveTrekMap, { type MapFocus } from '../components/LiveTrekMap'
import {
  formatAgo,
  isStale,
  LIVE_MAP_POLL_MS,
  trekColor,
} from '../lib/live-map'
import { cardClass } from '../lib/ui'
import { usePollingTick } from '../lib/use-polling'

type PageState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; treks: LiveTrek[]; loadedAt: Date }

const timeFormat = new Intl.DateTimeFormat('en-PH', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

export default function LiveMapPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const [picked, setPicked] = useState<MapFocus | null>(null)
  const tick = usePollingTick(LIVE_MAP_POLL_MS)

  useEffect(() => {
    let isCurrent = true

    async function load() {
      try {
        const idToken = await user!.getIdToken()
        const treks = await listLiveTreks(idToken)
        if (isCurrent)
          setState({ status: 'loaded', treks, loadedAt: new Date() })
      } catch {
        // Keep showing the last positions if a background refresh fails.
        if (isCurrent)
          setState((current) =>
            current.status === 'loaded' ? current : { status: 'error' },
          )
      }
    }

    void load()
    return () => {
      isCurrent = false
    }
  }, [user, tick])

  // Opened from "Track on live map": fly to that trek once it has a fix,
  // until the coordinator picks one from the list.
  const linkedBookingId = searchParams.get('booking')
  const linkedHasFix =
    state.status === 'loaded' &&
    state.treks.some((t) => t.bookingId === linkedBookingId && t.latest)
  const linkedFocus = useMemo<MapFocus | null>(
    () =>
      linkedBookingId && linkedHasFix
        ? { bookingId: linkedBookingId, nonce: 0 }
        : null,
    [linkedBookingId, linkedHasFix],
  )
  const focus = picked ?? linkedFocus

  return (
    <>
      <PageHeader eyebrow="Coordinator" title="Live map">
        Where each guide is right now and the path their group has walked, from
        the guide app's GPS. Positions arrive about every 15 seconds while the
        phone has signal.
      </PageHeader>

      {state.status === 'loading' && (
        <StatusCard role="status">Loading the live map…</StatusCard>
      )}
      {state.status === 'error' && (
        <StatusCard title="The live map couldn’t load">
          We couldn’t load the treks in progress. Please try again later.
        </StatusCard>
      )}
      {/* No map until someone is on the trail; polling brings it back. */}
      {state.status === 'loaded' && state.treks.length === 0 && (
        <StatusCard title="No treks on the trail">
          Guides appear here once they start a trek in the guide app. This page
          checks every 10 seconds.
        </StatusCard>
      )}
      {state.status === 'loaded' && state.treks.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <LiveTrekMap focus={focus} treks={state.treks} />

          <section aria-live="polite" className={cardClass}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold text-[#173a2e]">
                On the trail ({state.treks.length})
              </h2>
              <p className="text-xs text-[#70857b]">
                Updated {timeFormat.format(state.loadedAt)}
              </p>
            </div>
            <ul className="mt-3 grid gap-2">
              {state.treks.map((trek) => (
                <li key={trek.bookingId}>
                  <TrekEntry
                    now={state.loadedAt}
                    onSelect={() =>
                      setPicked({
                        bookingId: trek.bookingId,
                        nonce: Date.now(),
                      })
                    }
                    selected={focus?.bookingId === trek.bookingId}
                    trek={trek}
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  )
}

function TrekEntry({
  trek,
  now,
  selected,
  onSelect,
}: {
  trek: LiveTrek
  now: Date
  selected: boolean
  onSelect: () => void
}) {
  const stale = isStale(trek, now)
  return (
    <button
      className={`w-full rounded-xl border px-3 py-2.5 text-left hover:bg-[#f3f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] disabled:cursor-default disabled:hover:bg-transparent ${selected ? 'border-[#008755] bg-[#eef7f1]' : 'border-[#e7ece8]'}`}
      disabled={!trek.latest}
      onClick={onSelect}
      type="button"
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: trekColor(trek.bookingId) }}
        />
        <span className="truncate text-sm font-bold text-[#173a2e]">
          {trek.guide?.fullName ?? 'Unassigned guide'}
        </span>
        {stale && trek.latest && (
          <span className="ml-auto shrink-0 rounded-full bg-[#fdf3dc] px-2 py-0.5 text-xs font-bold text-[#7a5300]">
            Stale
          </span>
        )}
      </span>
      <span className="mt-1 block text-xs text-[#52675e]">
        {trek.trail.name} · {trek.participantCount}{' '}
        {trek.participantCount === 1 ? 'hiker' : 'hikers'}
      </span>
      <span className="mt-0.5 block text-xs text-[#70857b]">
        {trek.latest
          ? `Last position ${formatAgo(trek.latest.recordedAt, now)}${trek.latest.accuracyM !== null ? ` · ±${Math.round(trek.latest.accuracyM)} m` : ''}`
          : 'Waiting for the first position from the guide app'}
      </span>
    </button>
  )
}
