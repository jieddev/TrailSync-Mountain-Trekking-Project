import type { ChangeEventHandler, ReactNode } from 'react'
import { useState } from 'react'

import type { AgreementId } from '../agreements'
import AgreementModal from './AgreementModal'

type AgreementCheckboxProps = {
  checked: boolean
  error?: string
  id: string
  name: string
  onChange: ChangeEventHandler<HTMLInputElement>
  // Renders the label, given a function that makes an agreement link.
  children: (
    link: (agreementId: AgreementId, text: string) => ReactNode,
  ) => ReactNode
}

// A required "I agree" checkbox. The agreement links open the text in a modal
// so the surrounding form keeps what the user typed.
export default function AgreementCheckbox({
  checked,
  error,
  id,
  name,
  onChange,
  children,
}: AgreementCheckboxProps) {
  const [openAgreement, setOpenAgreement] = useState<AgreementId | null>(null)
  const errorId = `${id}-error`

  function link(agreementId: AgreementId, text: string) {
    return (
      <button
        className="font-bold text-[#007e4f] underline underline-offset-2 hover:text-[#006b43]"
        onClick={() => setOpenAgreement(agreementId)}
        type="button"
      >
        {text}
      </button>
    )
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          aria-describedby={errorId}
          aria-invalid={Boolean(error)}
          checked={checked}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#c8d7cf] accent-[#008755]"
          id={id}
          name={name}
          onChange={onChange}
          type="checkbox"
        />
        {/* Clicking a button inside a label opens the agreement without toggling the box. */}
        <label className="text-sm leading-5 text-[#3d5348]" htmlFor={id}>
          {children(link)}
        </label>
      </div>
      <p
        aria-live="polite"
        className="min-h-5 pt-1 text-sm text-rose-600"
        id={errorId}
      >
        {error}
      </p>
      <AgreementModal
        agreementId={openAgreement}
        onClose={() => setOpenAgreement(null)}
      />
    </div>
  )
}
