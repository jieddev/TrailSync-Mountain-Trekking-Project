import { signOut } from 'firebase/auth'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import logo from '../../../assets/trailsync-logo.png'
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
  const initial = displayName?.charAt(0).toUpperCase() ?? '?'
  const [menuOpen, setMenuOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
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
    <div className="flex min-h-screen flex-col bg-[#f7f7f1] text-[#062f22]">
      <header className="sticky top-0 z-30 border-b border-[#d5e1da] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-8">
          <NavLink
            className="inline-flex shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#008755]"
            onClick={() => setNavOpen(false)}
            to="/home"
          >
            <img alt="TrailSync" className="h-9 w-auto" src={logo} />
          </NavLink>

          <nav
            aria-label="Main navigation"
            className="hidden h-full items-center gap-1 lg:flex"
          >
            {navItems.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  `rounded-lg px-3.5 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] ${isActive ? 'bg-[#e8f1eb] text-[#006b43]' : 'text-[#52675e] hover:bg-[#f3f6f2] hover:text-[#173a2e]'}`
                }
                end={item.end}
                key={item.to}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="relative ml-auto hidden lg:block" ref={menuRef}>
            <button
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
              className="flex cursor-pointer items-center gap-2 rounded-full border border-[#d5e1da] bg-white py-1 pl-1 pr-2.5 hover:bg-[#f3f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]"
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-[#e8f1eb] text-sm font-bold text-[#006b43]">
                {initial}
              </span>
              <span className="max-w-40 truncate text-sm font-semibold text-[#173a2e]">
                {displayName ?? 'Account'}
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
                  className="mt-1 w-full cursor-pointer px-4 py-2 text-left text-sm font-bold text-[#007e4f] hover:bg-[#f3f6f2] focus-visible:bg-[#f3f6f2] focus-visible:outline-none"
                  onClick={handleLogout}
                  role="menuitem"
                  type="button"
                >
                  Log out
                </button>
              </div>
            )}
          </div>

          <button
            aria-controls="hiker-mobile-nav"
            aria-expanded={navOpen}
            aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
            className="ml-auto cursor-pointer rounded-lg border border-[#d5e1da] p-2 text-[#173a2e] hover:bg-[#f3f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] lg:hidden"
            onClick={() => setNavOpen((open) => !open)}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              {navOpen ? (
                <path
                  d="M6 6l12 12M18 6 6 18"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>
        </div>

        {navOpen && (
          <nav
            aria-label="Main navigation"
            className="border-t border-[#e7ece8] px-5 pb-5 pt-3 sm:px-8 lg:hidden"
            id="hiker-mobile-nav"
          >
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-[#e8f1eb] text-[#006b43]' : 'text-[#52675e] hover:bg-[#f3f6f2]'}`
                  }
                  end={item.end}
                  key={item.to}
                  onClick={() => setNavOpen(false)}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
            <div className="mt-3 border-t border-[#e7ece8] px-3 pt-4">
              {profile && (
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e8f1eb] text-sm font-bold text-[#006b43]">
                    {initial}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#173a2e]">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-[#70857b]">{email}</p>
                  </div>
                </div>
              )}
              <button
                className="mt-4 w-full cursor-pointer rounded-lg border border-[#d5e1da] px-3 py-2.5 text-left text-sm font-bold text-[#007e4f] hover:bg-[#f3f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]"
                onClick={handleLogout}
                type="button"
              >
                Log out
              </button>
            </div>
          </nav>
        )}
      </header>

      <main className="w-full flex-1 px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <footer className="mx-auto w-full max-w-6xl px-5 pb-6 text-xs text-[#70857b] sm:px-8">
        TrailSync · Trekking journeys, connected.
      </footer>
    </div>
  )
}
