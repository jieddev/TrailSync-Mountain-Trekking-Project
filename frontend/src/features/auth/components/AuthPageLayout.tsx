import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type AuthPageLayoutProps = {
  children: ReactNode
  description: string
  footerPrompt: string
  footerText: string
  footerTo: string
  title: string
}

export default function AuthPageLayout({
  children,
  description,
  footerPrompt,
  footerText,
  footerTo,
  title,
}: AuthPageLayoutProps) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:py-16">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
        <Link
          className="inline-flex rounded-sm text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-4 focus-visible:ring-offset-slate-900"
          to="/login"
        >
          TrailSync
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>

        {children}

        <p className="mt-6 text-center text-sm text-slate-300">
          {footerPrompt}{' '}
          <Link
            className="font-semibold text-emerald-400 underline-offset-4 outline-none hover:text-emerald-300 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-emerald-400"
            to={footerTo}
          >
            {footerText}
          </Link>
        </p>
      </section>
    </main>
  )
}
