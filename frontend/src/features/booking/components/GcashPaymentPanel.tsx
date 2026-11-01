import { useState } from 'react'

import type { Money, PaymentMethod } from '../../../lib/trails-api'
import { formatMoney } from '../lib/booking-form'

type GcashPaymentPanelProps = {
  method: PaymentMethod
  // What to send now: the downpayment or the full package price.
  amount: Money
}

// The GCash QR code and the account details for a manual transfer.
export default function GcashPaymentPanel({
  method,
  amount,
}: GcashPaymentPanelProps) {
  return (
    <div className="rounded-xl border border-[#c8d7cf] bg-[#f7faf8] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-[#173a2e]">
          Pay {formatMoney(amount)} with GCash
        </p>
        {method.testMode && (
          <span className="rounded-full bg-[#fdf3dc] px-2 py-0.5 text-xs font-bold text-[#7a5300]">
            Test mode · no real money
          </span>
        )}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-start">
        <figure className="justify-self-center">
          <img
            alt={`GCash QR code for ${method.accountName}`}
            className="size-40 rounded-lg border border-[#d5e1da] bg-white p-2"
            height={160}
            src={method.qrImagePath}
            width={160}
          />
          <figcaption className="pt-1 text-center text-xs text-[#70857b]">
            Scan in the GCash app
          </figcaption>
        </figure>
        <div className="text-sm">
          <p className="text-[#52675e]">Or send it manually:</p>
          <dl className="mt-2 grid gap-2">
            <CopyRow label="Account name" value={method.accountName} />
            <CopyRow label="GCash number" value={method.accountNumber} />
            <CopyRow
              label="Amount"
              value={String(amount.amount)}
              display={formatMoney(amount)}
            />
          </dl>
          <p className="mt-3 text-xs leading-5 text-[#70857b]">
            After paying, take a screenshot of the GCash receipt and upload it
            below. A tourism coordinator checks it before confirming.
          </p>
        </div>
      </div>
    </div>
  )
}

function CopyRow({
  label,
  value,
  display = value,
}: {
  label: string
  value: string
  display?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard needs a secure context (not plain-HTTP LAN testing); the
      // value is still on screen to copy by hand.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e7ece8] bg-white px-3 py-2">
      <div className="min-w-0">
        <dt className="text-xs text-[#70857b]">{label}</dt>
        <dd className="truncate font-semibold text-[#173a2e]">{display}</dd>
      </div>
      <button
        aria-label={`Copy ${label.toLowerCase()}`}
        className="shrink-0 rounded-md px-2 py-1 text-xs font-bold text-[#007e4f] hover:bg-[#f3f6f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]"
        onClick={copy}
        type="button"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
