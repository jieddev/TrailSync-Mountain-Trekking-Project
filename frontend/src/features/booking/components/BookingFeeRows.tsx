import type { BookingFees } from '../../../lib/bookings-api'
import { formatMoney } from '../lib/booking-form'

type BookingFeeRowsProps = {
  currency: string
  fees: BookingFees
  total: number
}

// Fee lines and total for a price summary <dl>. Renders nothing for trails
// without fees, where the package price is already the total.
export default function BookingFeeRows({
  currency,
  fees,
  total,
}: BookingFeeRowsProps) {
  if (fees.garbage + fees.environmental + fees.entrance === 0) return null
  const rows = [
    ['Garbage fee', fees.garbage],
    ['Environmental fee', fees.environmental],
    ['Entrance fee', fees.entrance],
    ['Total', total],
  ] as const
  return rows.map(([label, amount]) => (
    <div className="flex justify-between gap-3" key={label}>
      <dt className="text-[#70857b]">{label}</dt>
      <dd className="font-semibold text-[#173a2e]">
        {formatMoney({ amount, currency })}
      </dd>
    </div>
  ))
}
