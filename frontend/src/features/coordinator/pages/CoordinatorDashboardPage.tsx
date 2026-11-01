import { Link } from 'react-router-dom'

import type { CoordinatorSummary } from '../../../lib/coordinator-api'
import PageHeader from '../../booking/components/PageHeader'
import StatusCard from '../../booking/components/StatusCard'
import { useCoordinatorSummary } from '../lib/coordinator-summary'

type Tone = 'neutral' | 'attention' | 'urgent'

type SummaryCardProps = {
  to: string
  title: string
  count: number
  // Read by screen readers as "3 bookings to review".
  countLabel: string
  detail: string
  action: string
  // How the card looks when its count is above zero.
  tone?: Tone
  warning?: string | null
}

const toneClass: Record<Tone, string> = {
  neutral: 'border-[#d5e1da] bg-white',
  attention: 'border-[#e8c96a] bg-[#fff8e3]',
  urgent: 'border-rose-300 bg-rose-50',
}

const countClass: Record<Tone, string> = {
  neutral: 'text-[#002d20]',
  attention: 'text-[#7a5300]',
  urgent: 'text-rose-700',
}

function SummaryCard({
  to,
  title,
  count,
  countLabel,
  detail,
  action,
  tone = 'neutral',
  warning,
}: SummaryCardProps) {
  const activeTone: Tone = count > 0 ? tone : 'neutral'
  return (
    <li>
      <Link
        className={`flex h-full flex-col rounded-2xl border p-5 transition hover:border-[#9fc2b2] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] ${toneClass[activeTone]}`}
        to={to}
      >
        <p className="text-sm font-bold text-[#173a2e]">{title}</p>
        <p
          className={`mt-2 font-serif text-4xl font-bold leading-none ${countClass[activeTone]}`}
        >
          {count}
          <span className="sr-only"> {countLabel}</span>
        </p>
        <p className="mt-2 text-sm text-[#52675e]">{detail}</p>
        {warning && (
          <p className="mt-2 text-sm font-bold text-[#7a5300]">{warning}</p>
        )}
        <span className="mt-auto pt-4 text-sm font-bold text-[#007e4f]">
          {action} <span aria-hidden="true">→</span>
        </span>
      </Link>
    </li>
  )
}

const plural = (count: number, one: string, many: string) =>
  count === 1 ? one : many

function actionCards(summary: CoordinatorSummary): SummaryCardProps[] {
  const { bookings, dispatch, guides, guideApplications, incidents } = summary
  return [
    {
      to: '/coordinator/incidents',
      title: 'Open SOS alerts',
      count: incidents.open,
      countLabel: plural(incidents.open, 'open SOS alert', 'open SOS alerts'),
      detail:
        incidents.open > 0
          ? 'A guide asked for help. Acknowledge it right away.'
          : 'No guide has asked for help.',
      action: 'View incidents',
      tone: 'urgent',
    },
    {
      to: '/coordinator/bookings?tab=review',
      title: 'Bookings to review',
      count: bookings.needsReview,
      countLabel: plural(
        bookings.needsReview,
        'booking to review',
        'bookings to review',
      ),
      detail: 'Check the GCash receipt, then confirm the trek.',
      action: 'Review bookings',
      tone: 'attention',
    },
    {
      to: '/coordinator/dispatch',
      title: 'Groups waiting for a guide',
      count: dispatch.waitingForGuide,
      countLabel: plural(
        dispatch.waitingForGuide,
        'group waiting for a guide',
        'groups waiting for a guide',
      ),
      detail: 'Checked in at the office with no guide yet.',
      action: 'Assign guides',
      tone: 'attention',
      warning:
        dispatch.waitingForGuide > 0 && guides.available === 0
          ? 'No guide is in the queue. Mark a guide available first.'
          : null,
    },
    {
      to: '/coordinator/guide-applications',
      title: 'Guide account requests',
      count: guideApplications.pending,
      countLabel: plural(
        guideApplications.pending,
        'guide request to review',
        'guide requests to review',
      ),
      detail: 'New guides waiting for approval.',
      action: 'Review requests',
      tone: 'attention',
    },
    {
      to: '/coordinator/bookings?tab=hiker',
      title: 'Waiting on hiker',
      count: bookings.waitingOnHiker,
      countLabel: plural(
        bookings.waitingOnHiker,
        'booking waiting on the hiker',
        'bookings waiting on the hiker',
      ),
      detail: 'Receipt rejected. The hiker must upload a new one.',
      action: 'View bookings',
    },
  ]
}

function todayCards(summary: CoordinatorSummary): SummaryCardProps[] {
  const { bookings, dispatch, guides, trailRestrictions } = summary
  return [
    {
      to: '/coordinator/dispatch',
      title: 'Arriving today',
      count: bookings.arrivingToday,
      countLabel: plural(
        bookings.arrivingToday,
        'group arriving today',
        'groups arriving today',
      ),
      detail: 'Confirmed groups to check in at the office.',
      action: 'Check in groups',
    },
    {
      to: '/coordinator/live-map',
      title: 'On the trail',
      count: dispatch.onTrail,
      countLabel: plural(
        dispatch.onTrail,
        'group on the trail',
        'groups on the trail',
      ),
      detail: 'Groups with a guide, starting or trekking.',
      action: 'Open live map',
    },
    {
      to: '/coordinator/guides',
      title: 'Guides available',
      count: guides.available,
      countLabel: plural(
        guides.available,
        'guide in the queue',
        'guides in the queue',
      ),
      detail: guides.nextUp
        ? `Next up: ${guides.nextUp.fullName}. ${guides.onTrek} on a trek.`
        : `No guide in the queue. ${guides.onTrek} on a trek.`,
      action: 'Manage guide queue',
    },
    {
      to: '/coordinator/trail-restrictions',
      title: 'Trails closed today',
      count: trailRestrictions.active,
      countLabel: plural(
        trailRestrictions.active,
        'trail restriction today',
        'trail restrictions today',
      ),
      detail: 'Restrictions that block check-in today.',
      action: 'Manage restrictions',
      tone: 'attention',
    },
    {
      to: '/coordinator/bookings?tab=upcoming',
      title: 'Upcoming treks',
      count: bookings.upcoming,
      countLabel: plural(
        bookings.upcoming,
        'confirmed trek',
        'confirmed treks',
      ),
      detail: 'Confirmed bookings, including today.',
      action: 'View upcoming',
    },
  ]
}

export default function CoordinatorDashboardPage() {
  const { summary, failed } = useCoordinatorSummary()
  const actions = summary ? actionCards(summary) : []
  const allClear = actions.every((card) => card.count === 0)

  return (
    <>
      <PageHeader eyebrow="Coordinator" title="Dashboard">
        What needs you now, and how today is going. Select a card to open the
        page where you handle it.
      </PageHeader>

      {!summary && !failed && (
        <StatusCard role="status">Loading the dashboard…</StatusCard>
      )}
      {!summary && failed && (
        <StatusCard title="Dashboard couldn’t load">
          We couldn’t load the dashboard counts. Please try again later.
        </StatusCard>
      )}
      {summary && (
        <div className="grid gap-8">
          {failed && (
            <p
              className="rounded-xl border border-[#e8c96a] bg-[#fff8e3] px-4 py-3 text-sm font-semibold text-[#7a5300]"
              role="status"
            >
              Couldn’t refresh just now. These counts may be out of date.
            </p>
          )}
          <section aria-labelledby="needs-action-title">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2
                className="text-lg font-bold text-[#173a2e]"
                id="needs-action-title"
              >
                Needs your action
              </h2>
              {allClear && (
                <p className="text-sm font-semibold text-[#006b43]">
                  All caught up.
                </p>
              )}
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {actions.map((card) => (
                <SummaryCard key={card.title} {...card} />
              ))}
            </ul>
          </section>
          <section aria-labelledby="today-title">
            <h2
              className="mb-3 text-lg font-bold text-[#173a2e]"
              id="today-title"
            >
              Today
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {todayCards(summary).map((card) => (
                <SummaryCard key={card.title} {...card} />
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  )
}
