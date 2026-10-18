import { Outlet } from 'react-router-dom'

import { useProfile } from '../../../app/ProfileContext'
import type { HikerOutletContext } from '../hiker-profile'
import HikerAppShell from './HikerAppShell'

export default function HikerLayout() {
  const profileState = useProfile()
  const profile = profileState.status === 'loaded' ? profileState.profile : null

  return (
    <HikerAppShell profile={profile}>
      {(profileState.status === 'loading' ||
        profileState.status === 'signed-out') && (
        <section
          aria-live="polite"
          role="status"
          className="rounded-2xl border border-[#d5e1da] bg-white p-6 text-sm text-[#52675e] sm:p-9"
        >
          Loading your TrailSync profile…
        </section>
      )}
      {profileState.status === 'missing' && (
        <section
          aria-live="polite"
          className="rounded-2xl border border-[#d5e1da] bg-white p-6 sm:p-9"
        >
          <h1 className="font-serif text-3xl font-bold text-[#002d20]">
            Profile unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#52675e]">
            We couldn’t find a TrailSync profile for this account. Please
            contact support for help.
          </p>
        </section>
      )}
      {profileState.status === 'error' && (
        <section
          aria-live="polite"
          className="rounded-2xl border border-[#d5e1da] bg-white p-6 sm:p-9"
        >
          <h1 className="font-serif text-3xl font-bold text-[#002d20]">
            Profile couldn’t load
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#52675e]">
            We couldn’t load your TrailSync profile. Please try again later.
          </p>
        </section>
      )}
      {profileState.status === 'loaded' && (
        <Outlet
          context={
            { profile: profileState.profile } satisfies HikerOutletContext
          }
        />
      )}
    </HikerAppShell>
  )
}
