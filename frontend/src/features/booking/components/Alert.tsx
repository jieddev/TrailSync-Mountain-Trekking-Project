import type { ReactNode } from 'react'

type AlertProps = {
  tone: 'warning' | 'danger'
  title?: string
  children: ReactNode
  className?: string
}

const toneClasses = {
  warning: 'border-[#f0d9a6] bg-[#fdf3dc] text-[#7a5300]',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
}

// A notice the reader should act on, such as a trail closure.
export default function Alert({
  tone,
  title,
  children,
  className = '',
}: AlertProps) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm leading-6 ${toneClasses[tone]} ${className}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      {title && <p className="font-bold">{title}</p>}
      <div>{children}</div>
    </div>
  )
}
