import { useState, type ReactNode } from 'react'

import { primaryButtonClass, secondaryButtonClass } from '../lib/ui'

type ConfirmActionProps = {
  label: string
  busyLabel: string
  confirmLabel: string
  // Shown in place of the button before the action runs.
  question: ReactNode
  onConfirm: () => Promise<void>
  fullWidth?: boolean
}

// Two-step button: the first click asks, the second runs the action.
export default function ConfirmAction({
  label,
  busyLabel,
  confirmLabel,
  question,
  onConfirm,
  fullWidth = false,
}: ConfirmActionProps) {
  const [isAsking, setIsAsking] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  async function handleConfirm() {
    setIsBusy(true)
    try {
      await onConfirm()
    } finally {
      setIsBusy(false)
      setIsAsking(false)
    }
  }

  if (!isAsking) {
    return (
      <button
        className={`${fullWidth ? 'w-full ' : ''}${primaryButtonClass}`}
        onClick={() => setIsAsking(true)}
        type="button"
      >
        {label}
      </button>
    )
  }

  return (
    <div>
      <p className="text-sm leading-6 text-[#52675e]">{question}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className={primaryButtonClass}
          disabled={isBusy}
          onClick={() => void handleConfirm()}
          type="button"
        >
          {isBusy ? busyLabel : confirmLabel}
        </button>
        <button
          className={secondaryButtonClass}
          disabled={isBusy}
          onClick={() => setIsAsking(false)}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
