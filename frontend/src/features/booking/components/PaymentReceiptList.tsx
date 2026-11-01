import type { BookingPayment } from '../../../lib/bookings-api'
import { formatMoney } from '../lib/booking-form'
import ReceiptImage from './ReceiptImage'
import StatusBadge from './StatusBadge'

const receiptStatus = {
  SUBMITTED: { label: 'Under review', tone: 'pending' },
  ACCEPTED: { label: 'Accepted', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'declined' },
} as const

const dateTime = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

type PaymentReceiptListProps = {
  payment: BookingPayment
  loadImage: (receiptId: string) => Promise<Blob>
}

// Every receipt uploaded for a booking, newest first, with its review result.
export default function PaymentReceiptList({
  payment,
  loadImage,
}: PaymentReceiptListProps) {
  if (payment.receipts.length === 0) {
    return (
      <p className="text-sm text-[#52675e]">No receipt has been uploaded.</p>
    )
  }
  return (
    <ul className="grid gap-3">
      {payment.receipts.map((receipt, index) => {
        const status = receiptStatus[receipt.status]
        return (
          <li
            className="flex gap-4 rounded-xl border border-[#e7ece8] p-3"
            key={receipt.id}
          >
            <ReceiptImage
              alt={`GCash receipt uploaded ${dateTime.format(new Date(receipt.createdAt))}`}
              className="h-28 w-20"
              imageKey={receipt.id}
              load={() => loadImage(receipt.id)}
            />
            <div className="min-w-0 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={status.label} tone={status.tone} />
                {index === 0 && payment.receipts.length > 1 && (
                  <span className="text-xs font-bold text-[#70857b]">
                    Latest
                  </span>
                )}
              </div>
              <p className="mt-2 font-semibold text-[#173a2e]">
                {formatMoney({
                  amount: receipt.amount,
                  currency: payment.currency,
                })}
              </p>
              <p className="text-[#52675e]">
                Uploaded {dateTime.format(new Date(receipt.createdAt))}
              </p>
              {receipt.referenceNumber && (
                <p className="text-[#52675e]">
                  Ref. No. {receipt.referenceNumber}
                </p>
              )}
              {receipt.rejectionReason && (
                <p className="mt-1 text-rose-700">
                  <span className="font-bold">Reason:</span>{' '}
                  {receipt.rejectionReason}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
