import { useEffect, useState } from 'react'

import { useAuth } from '../../../app/AuthContext'
import { ApiError, getCurrentUserProfile } from '../../../lib/users-api'
import type { CurrentUserProfile } from '../../../lib/users-api'
import HikerAppShell from '../components/HikerAppShell'

type ProfileState =
  | { status: 'loading' }
  | { status: 'loaded'; profile: CurrentUserProfile }
  | { status: 'missing' }
  | { status: 'error' }

export default function HikerHomePage() {
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
        <>
          <section
            aria-labelledby="welcome-title"
            className="rounded-2xl border border-[#d5e1da] bg-white p-6 shadow-[0_12px_30px_rgba(0,45,32,0.035)] sm:p-9"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#008755]">
              Your TrailSync home
            </p>
            <h1
              id="welcome-title"
              className="mt-4 max-w-2xl font-serif text-4xl font-bold leading-tight tracking-[-0.045em] text-[#002d20] sm:text-5xl"
            >
              Ready for your next trekking experience?
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#52675e]">
              Your account is ready. Explore the available features or check
              back as more of TrailSync is added.
            </p>
            <dl className="mt-6 grid gap-3 border-t border-[#e7ece8] pt-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-[#70857b]">Full name</dt>
                <dd className="mt-1 text-[#173a2e]">
                  {profileState.profile.fullName}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[#70857b]">Email</dt>
                <dd className="mt-1 text-[#173a2e]">
                  {profileState.profile.email}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[#70857b]">Role</dt>
                <dd className="mt-1 text-[#173a2e]">
                  {profileState.profile.role}
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="features-title" className="mt-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#008755]">
              Explore
            </p>
            <h2
              id="features-title"
              className="mt-2 font-serif text-3xl tracking-[-0.035em] text-[#002d20]"
            >
              Your trekking experience
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-[#d5e1da] bg-white p-6">
                <p className="text-sm font-bold text-[#173a2e]">
                  Trekking information
                </p>
                <p className="mt-2 text-sm leading-6 text-[#52675e]">
                  Trail information will be available here when it is provided
                  by TrailSync.
                </p>
              </article>
              <article className="rounded-2xl border border-[#d5e1da] bg-white p-6">
                <p className="text-sm font-bold text-[#173a2e]">Booking</p>
                <p className="mt-2 text-sm leading-6 text-[#52675e]">
                  Booking is not available yet. This space will be your starting
                  point when the feature is ready.
                </p>
                <button
                  aria-disabled="true"
                  className="mt-5 cursor-not-allowed rounded-lg bg-[#e5eee8] px-4 py-2.5 text-sm font-bold text-[#70857b]"
                  disabled
                  type="button"
                >
                  Coming soon
                </button>
              </article>
            </div>
          </section>
        </>
      )}
    </HikerAppShell>
  )
}
