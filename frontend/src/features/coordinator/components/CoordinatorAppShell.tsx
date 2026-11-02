import { signOut } from 'firebase/auth'
import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import type { CurrentUserProfile } from '../../../lib/users-api'
import type { CoordinatorSummary } from '../../../lib/coordinator-api'
import { auth } from '../../../lib/firebase'
import { useCoordinatorSummary } from '../lib/coordinator-summary'

type NavItem = {
  to: string
  label: string
  // Exact match only, so the dashboard isn't highlighted on every page.
  end?: boolean
  // A count that needs the coordinator, shown as a badge when above zero.
  badge?: (summary: CoordinatorSummary) => number
  badgeLabel?: string
  urgent?: boolean
}

const navSections: { heading: string | null; items: NavItem[] }[] = [
  {
    heading: null,
    items: [{ to: '/coordinator', label: 'Dashboard', end: true }],
  },
  {
    heading: 'Today',
    items: [
      {
        to: '/coordinator/dispatch',
        label: 'Check-in & dispatch',
        badge: (summary) => summary.dispatch.waitingForGuide,
        badgeLabel: 'waiting for a guide',
      },
      { to: '/coordinator/live-map', label: 'Live map' },
      {
        to: '/coordinator/incidents',
        label: 'Incidents',
        badge: (summary) => summary.incidents.open,
        badgeLabel: 'open SOS',
        urgent: true,
      },
    ],
  },
  {
    heading: 'Bookings',
    items: [
      {
        to: '/coordinator/bookings',
        label: 'Bookings',
        badge: (summary) => summary.bookings.needsReview,
        badgeLabel: 'to review',
      },
    ],
  },
  {
    heading: 'Guides',
    items: [
      { to: '/coordinator/guides', label: 'Guide queue' },
      {
        to: '/coordinator/guide-applications',
        label: 'Guide requests',
        badge: (summary) => summary.guideApplications.pending,
        badgeLabel: 'pending',
      },
    ],
  },
  {
    heading: 'Trails',
    items: [
      { to: '/coordinator/trail-restrictions', label: 'Trail restrictions' },
    ],
  },
  {
    heading: 'Reports',
    items: [{ to: '/coordinator/analytics', label: 'Analytics' }],
  },
]

type CoordinatorAppShellProps = {
  children: ReactNode
  profile: CurrentUserProfile | null
}

export default function CoordinatorAppShell({
  children,
  profile,
}: CoordinatorAppShellProps) {
  const navigate = useNavigate()
  const { summary } = useCoordinatorSummary()

  async function handleLogout() {
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f3f5f1] text-[#062f22] lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="bg-[#002d20] px-5 py-5 text-white lg:flex lg:min-h-screen lg:flex-col lg:px-5 lg:py-8">
        <div className="flex items-center justify-between gap-3 lg:block">
          <div>
            <NavLink
              className="inline-flex rounded-sm text-[11px] font-bold uppercase tracking-[0.16em] text-[#7fd1a8] outline-none focus-visible:ring-2 focus-visible:ring-[#7fd1a8]"
              to="/coordinator"
            >
              TrailSync
            </NavLink>
            <p className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#d8efe2]">
              Coordinator
            </p>
          </div>
          <button
            className="rounded-lg border border-white/20 px-3 py-2 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7fd1a8] lg:hidden"
            onClick={handleLogout}
            type="button"
          >
            Log out
          </button>
        </div>
        <nav
          aria-label="Coordinator navigation"
          className="mt-5 flex gap-2 overflow-x-auto lg:mt-10 lg:flex-col lg:gap-6 lg:overflow-visible"
        >
          {navSections.map((section) => (
            <div
              className="flex shrink-0 gap-2 lg:flex-col lg:gap-1"
              key={section.heading ?? 'home'}
            >
              {section.heading && (
                <p className="hidden px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9fc4b1] lg:block">
                  {section.heading}
                </p>
              )}
              {section.items.map((item) => {
                const count = summary && item.badge ? item.badge(summary) : 0
                return (
                  <NavLink
                    className={({ isActive }) =>
                      `flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-white text-[#002d20]' : 'text-[#d8efe2] hover:bg-white/10'}`
                    }
                    end={item.end}
                    key={item.to}
                    to={item.to}
                  >
                    {item.label}
                    {count > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.urgent ? 'bg-rose-600 text-white' : 'bg-[#f2c94c] text-[#3d2c00]'}`}
                      >
                        {count}
                        <span className="sr-only"> {item.badgeLabel}</span>
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
        {profile && (
          <div className="mt-auto hidden border-t border-white/15 pt-5 lg:block">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9fc4b1]">
              Signed in as
            </p>
            <p className="mt-2 truncate text-sm font-semibold">
              {profile.fullName}
            </p>
            <p className="mt-1 truncate text-xs text-[#9fc4b1]">
              {profile.email}
            </p>
            <button
              className="mt-5 text-sm font-bold text-[#7fd1a8] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7fd1a8]"
              onClick={handleLogout}
              type="button"
            >
              Log out
            </button>
          </div>
        )}
      </aside>
      <main className="w-full min-w-0 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
