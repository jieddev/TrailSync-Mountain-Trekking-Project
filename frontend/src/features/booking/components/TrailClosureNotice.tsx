import type { TrailClosure } from '../../../lib/trail-restrictions-api'
import { formatDateRange } from '../lib/booking-form'
import Alert from './Alert'

type TrailClosureNoticeProps = {
  closures: TrailClosure[]
  className?: string
}

// Lists a trail's current and upcoming closures with the coordinator's reason.
export default function TrailClosureNotice({
  closures,
  className,
}: TrailClosureNoticeProps) {
  if (!closures.length) return null
  const closedToday = closures.some((closure) => closure.status === 'ACTIVE')
  return (
    <Alert
      className={className}
      title={closedToday ? 'Closed today' : 'Upcoming closure'}
      tone={closedToday ? 'danger' : 'warning'}
    >
      <ul>
        {closures.map((closure) => (
          <li key={closure.id}>
            <span className="font-semibold">
              {formatDateRange(closure.startDate, closure.endDate)}:
            </span>{' '}
            {closure.reason}
          </li>
        ))}
      </ul>
    </Alert>
  )
}
