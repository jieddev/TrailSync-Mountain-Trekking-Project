import { Link } from 'react-router-dom'

import type { TrailRestriction } from '../../../lib/trail-restrictions-api'
import { formatDateRange } from '../../booking/lib/booking-form'

type DashboardAlertsProps = {
  closures: TrailRestriction[]
  thunderstorm: boolean
}

// Trails closed today, and an advisory when today's forecast has a
// thunderstorm. Weather never closes a trail; the coordinator decides.
export default function DashboardAlerts({
  closures,
  thunderstorm,
}: DashboardAlertsProps) {
  if (closures.length === 0 && !thunderstorm) return null
  return (
    <div className="grid gap-3">
      {closures.map((closure) => (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          key={closure.id}
          role="alert"
        >
          <p>
            <span className="font-bold">
              {closure.trail.name} is closed today.
            </span>{' '}
            {closure.reason}
            {closure.endDate !== closure.startDate &&
              ` · ${formatDateRange(closure.startDate, closure.endDate)}`}
          </p>
          <Link
            className="font-bold text-rose-800 underline-offset-4 hover:underline"
            to="/coordinator/trail-restrictions"
          >
            Manage
          </Link>
        </div>
      ))}
      {thunderstorm && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e8c96a] bg-[#fff8e3] px-4 py-3 text-sm text-[#7a5300]"
          role="status"
        >
          <p>
            <span className="font-bold">Thunderstorms are forecast today.</span>{' '}
            Weather is advisory. Close a trail if conditions are unsafe.
          </p>
          <Link
            className="font-bold text-[#7a5300] underline-offset-4 hover:underline"
            to="/coordinator/trail-restrictions"
          >
            Trail restrictions
          </Link>
        </div>
      )}
    </div>
  )
}
