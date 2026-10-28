import { signOut } from 'firebase/auth'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import type { CurrentUserProfile } from '../../../lib/users-api'
import { auth } from '../../../lib/firebase'

const navItems = [
  { to: '/home', label: 'Home', end: true },
  { to: '/trails', label: 'Trails', end: false },
  { to: '/bookings', label: 'My bookings', end: false },
]

type HikerAppShellProps = {
  children: ReactNode
  profile: CurrentUserProfile | null
}

export default function HikerAppShell({
  children,
  profile,
}: HikerAppShellProps) {
  const navigate = useNavigate()
  const displayName = profile?.fullName
  const email = profile?.email
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

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
          {navItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `shrink-0 rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-[#e8f1eb] text-[#006b43]' : 'text-[#52675e] hover:bg-[#f3f6f2]'}`
              }
              end={item.end}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-[#d5e1da] px-5 py-4 sm:px-8 lg:px-10">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#173a2e]">
              {profile ? `Welcome, ${displayName}` : 'TrailSync account'}
            </p>
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
              className="cursor-pointer flex items-center gap-2 rounded-full border border-[#d5e1da] bg-white py-1 pl-1 pr-2.5 hover:bg-[#f3f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]"
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-[#e8f1eb] text-xs font-bold text-[#006b43]">
                {displayName?.charAt(0).toUpperCase() ?? '?'}
              </span>
              <svg
                aria-hidden="true"
                className={`size-4 text-[#52675e] transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  d="m6 9 6 6 6-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-[#d5e1da] bg-white py-2 shadow-lg"
                role="menu"
              >
                {profile && (
                  <div className="border-b border-[#e7ece8] px-4 pb-3 pt-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#70857b]">
                      Signed in as
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#173a2e]">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-[#70857b]">{email}</p>
                  </div>
                )}
                <button
                  className="mt-1 w-full px-4 py-2 text-left text-sm font-bold text-[#007e4f] hover:bg-[#f3f6f2] focus-visible:bg-[#f3f6f2] focus-visible:outline-none"
                  onClick={handleLogout}
                  role="menuitem"
                  type="button"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
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
