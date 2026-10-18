import type { ReactNode } from 'react'

type PageHeaderProps = {
  eyebrow: string
  title: string
  children?: ReactNode
}

export default function PageHeader({
  eyebrow,
  title,
  children,
}: PageHeaderProps) {
  return (
    <header className="mb-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#008755]">
        {eyebrow}
      </p>
      <h1 className="mt-2 font-serif text-4xl font-bold leading-tight tracking-[-0.045em] text-[#002d20]">
        {title}
      </h1>
      {children && (
        <div className="mt-3 max-w-2xl text-base leading-7 text-[#52675e]">
          {children}
        </div>
      )}
    </header>
  )
}
