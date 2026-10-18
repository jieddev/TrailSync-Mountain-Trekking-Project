import type { ReactNode } from 'react'

type StatusCardProps = {
  title?: string
  children: ReactNode
  role?: 'status' | 'alert'
}

// Loading, empty, and error states share one card so pages stay consistent.
export default function StatusCard({ title, children, role }: StatusCardProps) {
  return (
    <section
      aria-live="polite"
      role={role}
      className="rounded-2xl border border-[#d5e1da] bg-white p-6 text-sm leading-6 text-[#52675e] sm:p-9"
    >
      {title && (
        <h2 className="mb-2 font-serif text-2xl font-bold text-[#002d20]">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}
