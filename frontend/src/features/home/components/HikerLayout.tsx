import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import { ApiError, getCurrentUserProfile } from '../../../lib/users-api'
import type { CurrentUserProfile } from '../../../lib/users-api'
import type { HikerOutletContext } from '../hiker-profile'
import HikerAppShell from './HikerAppShell'

type ProfileState =
  | { status: 'loading' }
  | { status: 'loaded'; profile: CurrentUserProfile }
  | { status: 'missing' }
  | { status: 'error' }

export default function HikerLayout() {
  const { user } = useAuth()
  const [profileState, setProfileState] = useState<ProfileState>({
    status: 'loading',
  })

  useEffect(() => {
    let isCurrent = true

    async function loadProfile() {
      setProfileState({ status: 'loading' })
      try {
        const idToken = await user!.getIdToken()
        const profile = await getCurrentUserProfile(idToken)
        if (isCurrent) setProfileState({ status: 'loaded', profile })
      } catch (error) {
        if (!isCurrent) return
        setProfileState({
          status:
            error instanceof ApiError &&
            error.status === 404 &&
            error.code === 'PROFILE_NOT_FOUND'
              ? 'missing'
              : 'error',
        })
      }
    }

    void loadProfile()
    return () => {
      isCurrent = false
    }
  }, [user])

  const profile = profileState.status === 'loaded' ? profileState.profile : null

  return (
    <HikerAppShell profile={profile}>
      {profileState.status === 'loading' && (
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
