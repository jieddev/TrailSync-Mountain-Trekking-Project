import { useEffect, useRef } from 'react'

import { type AgreementId, agreements } from '../agreements'

type AgreementModalProps = {
  agreementId: AgreementId | null
  onClose: () => void
}

// Native <dialog> gives focus trapping, Esc to close, and a backdrop for free.
export default function AgreementModal({
  agreementId,
  onClose,
}: AgreementModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const agreement = agreementId ? agreements[agreementId] : null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (agreement && !dialog.open) dialog.showModal()
    if (!agreement && dialog.open) dialog.close()
  }, [agreement])

  return (
    <dialog
      aria-labelledby="agreement-title"
      className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-[#d5e1da] bg-white p-0 text-[#173a2e] backdrop:bg-[#0f2a20]/50"
      onClose={onClose}
      ref={dialogRef}
    >
      {agreement ? (
        <div className="flex max-h-[85vh] flex-col">
          <header className="border-b border-[#e7ece8] px-6 py-4">
            <h2 className="text-lg font-bold" id="agreement-title">
              {agreement.title}
            </h2>
            <p className="text-xs text-[#70857b]">
              Version {agreement.version}
            </p>
          </header>
          <div className="space-y-5 overflow-y-auto px-6 py-5 text-sm leading-6 text-[#3d5348]">
            {agreement.sections.map((section) => (
              <section key={section.heading}>
                <h3 className="mb-1 font-bold text-[#173a2e]">
                  {section.heading}
                </h3>
                {section.paragraphs.map((paragraph) => (
                  <p className="mt-1" key={paragraph}>
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
          <footer className="flex justify-end border-t border-[#e7ece8] px-6 py-4">
            <button
              autoFocus
              className="rounded-xl bg-[#008755] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#006b43] focus:outline-none focus:ring-2 focus:ring-[#008755]/30"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              Close
            </button>
          </footer>
        </div>
      ) : null}
    </dialog>
  )
}
