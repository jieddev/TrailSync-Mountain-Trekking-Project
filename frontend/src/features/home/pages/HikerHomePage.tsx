import { Link } from 'react-router-dom'

import TrailPreviewMap from '../components/TrailPreviewMap'
import { useHikerProfile } from '../hiker-profile'
import { SULFATARA_PREVIEW } from '../trail-previews'

export default function HikerHomePage() {
  const profile = useHikerProfile()

  return (
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
          Your account is ready. Explore the available features or check back as
          more of TrailSync is added.
        </p>
        <dl className="mt-6 grid gap-3 border-t border-[#e7ece8] pt-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-[#70857b]">Full name</dt>
            <dd className="mt-1 text-[#173a2e]">{profile.fullName}</dd>
          </div>
          <div>
            <dt className="font-semibold text-[#70857b]">Email</dt>
            <dd className="mt-1 text-[#173a2e]">{profile.email}</dd>
          </div>
          <div>
            <dt className="font-semibold text-[#70857b]">Role</dt>
            <dd className="mt-1 text-[#173a2e]">{profile.role}</dd>
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
          <article className="rounded-2xl border border-[#d5e1da] bg-white p-4 md:col-span-2 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#173a2e]">
                  {SULFATARA_PREVIEW.name}
                </p>
                <p className="mt-1 text-sm text-[#52675e]">
                  {SULFATARA_PREVIEW.subtitle}
                </p>
              </div>
              <span className="rounded-full bg-[#e8f1eb] px-3 py-1 text-xs font-bold text-[#006b43]">
                3D terrain preview
              </span>
            </div>
            <TrailPreviewMap preview={SULFATARA_PREVIEW} />
          </article>
          <article className="rounded-2xl border border-[#d5e1da] bg-white p-6">
            <p className="text-sm font-bold text-[#173a2e]">Booking</p>
            <p className="mt-2 text-sm leading-6 text-[#52675e]">
              Choose a trail, pick your date and time, and list who is joining
              your group.
            </p>
            <Link
              className="mt-5 inline-flex rounded-lg bg-[#008755] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#006b43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755] focus-visible:ring-offset-2"
              to="/trails"
            >
              Book a trek
            </Link>
          </article>
        </div>
      </section>
    </>
  )
}
