import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type AuthPageLayoutProps = {
  children: ReactNode
  description: string
  formTitle: string
  footerPrompt: string
  footerText: string
  footerTo: string
  title: string
}

export default function AuthPageLayout({
  children,
  description,
  formTitle,
  footerPrompt,
  footerText,
  footerTo,
  title,
}: AuthPageLayoutProps) {
  return (
    <main className="min-h-screen bg-[#f7f7f1] px-5 py-8 text-[#062f22] sm:px-10 sm:py-12 lg:px-[7.2%] lg:py-7">
      <section className="mx-auto grid w-full max-w-[1056px] gap-10 lg:min-h-[786px] lg:grid-cols-[minmax(0,432px)_minmax(0,528px)] lg:gap-24">
        <div className="lg:pt-0">
          <Link
            className="inline-flex rounded-sm text-[11px] font-bold uppercase tracking-[0.16em] text-[#008755] outline-none focus-visible:ring-2 focus-visible:ring-[#008755] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f7f7f1]"
            to="/login"
          >
            TrailSync access
          </Link>
          <h1 className="mt-4 max-w-md font-serif text-5xl font-bold leading-[0.9] tracking-[-0.055em] text-[#002d20] sm:text-6xl lg:text-[4.7rem]">
            {title}
          </h1>
          <p className="mt-7 max-w-[28rem] text-base leading-7 text-[#52675e]">
            {description}
          </p>
        </div>

        <div className="w-full lg:pt-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#008755]">
            Account access
          </p>
          <h2 className="mt-5 font-serif text-[2.3rem] leading-none tracking-[-0.04em] text-[#002d20] sm:text-[2.65rem]">
            {formTitle}
          </h2>
          <section className="mt-8 rounded-2xl border border-[#d5e1da] bg-white p-5 shadow-[0_12px_30px_rgba(0,45,32,0.035)] sm:p-7">
            {children}
          </section>

          <p className="mt-5 text-sm text-[#52675e]">
            {footerPrompt}{' '}
            <Link
              className="font-bold text-[#007e4f] underline-offset-4 outline-none hover:text-[#005f3c] hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#008755]"
              to={footerTo}
            >
              {footerText}
            </Link>
          </p>
        </div>
      </section>
      <p className="mt-10 text-xs text-[#52675e] lg:mt-[-2.25rem]">
        TrailSync · Trekking journeys, connected.
      </p>
    </main>
  )
}
