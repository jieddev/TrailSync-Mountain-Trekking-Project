import { signOut } from 'firebase/auth'
import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import type { CurrentUserProfile } from '../../../lib/users-api'
import { auth } from '../../../lib/firebase'
import { useOpenIncidentCount } from '../lib/use-open-incident-count'

const navItems = [
  { to: '/coordinator/bookings', label: 'Booking queue' },
  { to: '/coordinator/dispatch', label: 'Check-in & dispatch' },
  { to: '/coordinator/guides', label: 'Guide queue' },
  { to: '/coordinator/guide-applications', label: 'Guide requests' },
  { to: '/coordinator/trail-restrictions', label: 'Trail restrictions' },
  { to: '/coordinator/incidents', label: 'Incidents' },
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
  const openIncidents = useOpenIncidentCount(profile !== null)

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
              to="/coordinator/bookings"
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
          className="mt-5 flex gap-2 overflow-x-auto lg:mt-10 lg:flex-col"
        >
          {navItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `shrink-0 rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-white text-[#002d20]' : 'text-[#d8efe2] hover:bg-white/10'}`
              }
              key={item.to}
              to={item.to}
            >
              {item.label}
              {item.to === '/coordinator/incidents' && openIncidents > 0 && (
                <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
                  {openIncidents}
                  <span className="sr-only"> open SOS</span>
                </span>
              )}
            </NavLink>
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
