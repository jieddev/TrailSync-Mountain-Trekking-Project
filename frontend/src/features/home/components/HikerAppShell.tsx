import { signOut } from 'firebase/auth'
import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import { auth } from '../../../lib/firebase'

type HikerAppShellProps = { children: ReactNode }

export default function HikerAppShell({ children }: HikerAppShellProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const displayName =
    user?.displayName?.trim() || user?.email?.split('@')[0] || 'Hiker'
  const email = user?.email

  async function handleLogout() {
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f7f7f1] text-[#062f22] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-[#d5e1da] bg-white px-5 py-5 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
        <NavLink
          className="inline-flex rounded-sm text-[11px] font-bold uppercase tracking-[0.16em] text-[#008755] outline-none focus-visible:ring-2 focus-visible:ring-[#008755]"
          to="/home"
        >
          TrailSync
        </NavLink>
        <p className="mt-1 text-xs text-[#70857b]">
          Trekking journeys, connected.
        </p>
        <nav
          aria-label="Main navigation"
          className="mt-6 flex gap-2 overflow-x-auto lg:mt-12 lg:flex-col"
        >
          <NavLink
            className={({ isActive }) =>
              `shrink-0 rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-[#e8f1eb] text-[#006b43]' : 'text-[#52675e] hover:bg-[#f3f6f2]'}`
            }
            end
            to="/home"
          >
            Home
          </NavLink>
          <span
            aria-disabled="true"
            className="shrink-0 rounded-lg px-3 py-2.5 text-sm text-[#9aa9a1]"
          >
            Booking · coming soon
          </span>
        </nav>
        <div className="mt-6 hidden border-t border-[#e7ece8] pt-5 lg:block lg:mt-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#70857b]">
            Signed in as
          </p>
          <p className="mt-2 truncate text-sm font-semibold text-[#173a2e]">
            {displayName}
          </p>
          {email && (
            <p className="mt-1 truncate text-xs text-[#70857b]">{email}</p>
          )}
          <button
            className="mt-5 text-sm font-bold text-[#007e4f] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]"
            onClick={handleLogout}
            type="button"
          >
            Log out
          </button>
        </div>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-[#d5e1da] px-5 py-4 sm:px-8 lg:px-10">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#173a2e]">
              Welcome, {displayName}
            </p>
            <p className="truncate text-xs text-[#70857b] sm:hidden">{email}</p>
          </div>
          <button
            className="shrink-0 rounded-lg border border-[#d5e1da] bg-white px-3 py-2 text-sm font-bold text-[#007e4f] hover:bg-[#f3f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]"
            onClick={handleLogout}
            type="button"
          >
            Log out
          </button>
        </header>
        <main className="w-full flex-1 px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
        <footer className="px-5 pb-6 text-xs text-[#70857b] sm:px-8 lg:px-10">
          TrailSync · Trekking journeys, connected.
        </footer>
      </div>
    </div>
  )
}
