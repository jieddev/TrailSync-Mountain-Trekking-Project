import type { StatusTone } from '../lib/booking-status'

const toneClasses: Record<StatusTone, string> = {
  pending: 'bg-[#fdf3dc] text-[#7a5300]',
  success: 'bg-[#e8f1eb] text-[#006b43]',
}

export default function StatusBadge({
  label,
  tone,
}: {
  label: string
  tone: StatusTone
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${toneClasses[tone]}`}
    >
      {label}
    </span>
  )
}
