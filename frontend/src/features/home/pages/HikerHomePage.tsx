import HikerAppShell from '../components/HikerAppShell'

export default function HikerHomePage() {
  return (
    <HikerAppShell>
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
              Trail information will be available here when it is provided by
              TrailSync.
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
    </HikerAppShell>
  )
}
