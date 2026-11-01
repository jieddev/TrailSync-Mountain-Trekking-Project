import { useEffect, useId, useRef, useState } from 'react'

import AuthFormField from '../../auth/components/AuthFormField'
import { RECEIPT_TYPES } from '../lib/booking-form'

type ReceiptUploadFieldProps = {
  receipt: File | null
  referenceNumber: string
  onReceiptChange: (file: File | null) => void
  onReferenceNumberChange: (value: string) => void
  receiptError?: string
  referenceNumberError?: string
  idPrefix?: string
}

// Picks the GCash receipt screenshot and shows a preview before sending.
export default function ReceiptUploadField({
  receipt,
  referenceNumber,
  onReceiptChange,
  onReferenceNumberChange,
  receiptError,
  referenceNumberError,
  idPrefix = 'payment',
}: ReceiptUploadFieldProps) {
  const generatedId = useId()
  const inputId = `${idPrefix}-receipt-${generatedId}`
  const errorId = `${inputId}-error`
  // The preview URL is made when a file is picked (not in an effect) and is
  // shown only while that file is still the selected one.
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(
    null,
  )
  const latestUrl = useRef('')
  const previewUrl = preview && preview.file === receipt ? preview.url : ''

  useEffect(
    () => () => {
      if (latestUrl.current) URL.revokeObjectURL(latestUrl.current)
    },
    [],
  )

  function handleFile(file: File | null) {
    if (latestUrl.current) URL.revokeObjectURL(latestUrl.current)
    latestUrl.current = file ? URL.createObjectURL(file) : ''
    setPreview(file ? { file, url: latestUrl.current } : null)
    onReceiptChange(file)
  }

  return (
    <div className="grid gap-2">
      <div>
        <label
          className="mb-2 block text-sm font-bold text-[#173a2e]"
          htmlFor={inputId}
        >
          GCash receipt screenshot
        </label>
        <div
          className={`flex flex-col gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center ${receiptError ? 'border-rose-300 bg-rose-50/40' : 'border-[#c8d7cf] bg-white'}`}
        >
          {previewUrl ? (
            <img
              alt="Preview of the selected receipt"
              className="h-28 w-20 shrink-0 rounded-md border border-[#e7ece8] object-cover"
              src={previewUrl}
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-28 w-20 shrink-0 items-center justify-center rounded-md bg-[#f3f6f2] text-xs text-[#83958c]"
            >
              No image
            </div>
          )}
          <div className="min-w-0 text-sm">
            <input
              accept={RECEIPT_TYPES.join(',')}
              aria-describedby={errorId}
              aria-invalid={Boolean(receiptError)}
              className="block w-full text-sm text-[#52675e] file:mr-3 file:rounded-lg file:border file:border-[#d5e1da] file:bg-white file:px-3 file:py-2 file:text-sm file:font-bold file:text-[#007e4f] hover:file:bg-[#f3f6f2]"
              id={inputId}
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            <p className="pt-2 text-xs text-[#70857b]">
              {receipt
                ? `${receipt.name} · ${(receipt.size / 1024 / 1024).toFixed(2)} MB`
                : 'JPG, PNG or WebP, up to 5 MB.'}
            </p>
          </div>
        </div>
        <p
          aria-live="polite"
          className="min-h-5 pt-1 text-sm text-rose-600"
          id={errorId}
        >
          {receiptError}
        </p>
      </div>
      <AuthFormField
        autoComplete="off"
        error={referenceNumberError}
        hint="Optional. The 13-digit Ref. No. on your GCash receipt."
        id={`${idPrefix}-reference-number`}
        inputMode="numeric"
        label="GCash reference number (optional)"
        name="referenceNumber"
        onChange={(event) => onReferenceNumberChange(event.target.value)}
        type="text"
        value={referenceNumber}
      />
    </div>
  )
}
