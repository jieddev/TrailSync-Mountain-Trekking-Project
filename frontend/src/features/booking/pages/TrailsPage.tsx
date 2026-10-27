import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import type { TrailClosure } from '../../../lib/trail-restrictions-api'
import { listTrails, type Trail } from '../../../lib/trails-api'
import PageHeader from '../components/PageHeader'
import StatusCard from '../components/StatusCard'
import TrailClosureNotice from '../components/TrailClosureNotice'
import { formatMoney } from '../lib/booking-form'
import { useTrailClosures } from '../lib/use-trail-closures'

type TrailsState =
  | { status: 'loading' }
  | { status: 'loaded'; trails: Trail[] }
  | { status: 'error' }

export default function TrailsPage() {
  const [state, setState] = useState<TrailsState>({ status: 'loading' })
  const closures = useTrailClosures(
    state.status === 'loaded' ? state.trails.map((trail) => trail.id) : [],
  )

  useEffect(() => {
    let isCurrent = true
    listTrails()
      .then((trails) => {
        if (isCurrent) setState({ status: 'loaded', trails })
      })
      .catch(() => {
        if (isCurrent) setState({ status: 'error' })
      })
    return () => {
      isCurrent = false
    }
  }, [])

  return (
    <>
      <PageHeader eyebrow="Trails" title="Choose your trail">
        Each booking is one group package with a guide. The package price stays
        the same however many people join, up to the group limit, and the group
        includes you.
      </PageHeader>

      {state.status === 'loading' && (
        <StatusCard role="status">Loading trails…</StatusCard>
      )}
      {state.status === 'error' && (
        <StatusCard title="Trails couldn’t load">
          We couldn’t load the trail list. Please try again later.
        </StatusCard>
      )}
      {state.status === 'loaded' && state.trails.length === 0 && (
        <StatusCard title="No trails open">
          No trails are open for booking right now. Please check back later.
        </StatusCard>
      )}
      {state.status === 'loaded' && state.trails.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {state.trails.map((trail) => (
            <li key={trail.id}>
              <TrailCard closures={closures[trail.id] ?? []} trail={trail} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function TrailCard({
  trail,
  closures,
}: {
  trail: Trail
  closures: TrailClosure[]
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-[#d5e1da] bg-white p-6">
      <h2 className="font-serif text-2xl font-bold tracking-[-0.03em] text-[#002d20]">
        {trail.name}
      </h2>
      {trail.description && (
        <p className="mt-2 text-sm leading-6 text-[#52675e]">
          {trail.description}
        </p>
      )}
      <TrailClosureNotice className="mt-4" closures={closures} />
      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-[#e7ece8] pt-4 text-sm">
        <div>
          <dt className="font-semibold text-[#70857b]">Package price</dt>
          <dd className="mt-1 text-lg font-bold text-[#173a2e]">
            {formatMoney(trail.package.price)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-[#70857b]">
            Downpayment ({trail.paymentRequirement.downpaymentPercent}%)
          </dt>
          <dd className="mt-1 text-lg font-bold text-[#173a2e]">
            {formatMoney(trail.paymentRequirement)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="sr-only">Group size</dt>
          <dd className="text-[#52675e]">
            Up to {trail.package.maximumParticipants} participants ·{' '}
            {trail.package.guideCount}{' '}
            {trail.package.guideCount === 1 ? 'guide' : 'guides'}
          </dd>
        </div>
      </dl>
      <Link
        className="mt-6 inline-flex self-start rounded-lg bg-[#008755] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#006b43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] focus-visible:ring-offset-2"
        to={`/bookings/new?trailId=${encodeURIComponent(trail.id)}`}
      >
        Book this trail
      </Link>
    </article>
  )
}
