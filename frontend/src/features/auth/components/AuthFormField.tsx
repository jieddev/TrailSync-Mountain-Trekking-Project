import type { ChangeEventHandler, FocusEventHandler, ReactNode } from 'react'

type AuthFormFieldProps = {
  autoComplete: string
  error?: string
  hint?: string
  id: string
  label: string
  name: string
  onBlur?: FocusEventHandler<HTMLInputElement>
  onChange: ChangeEventHandler<HTMLInputElement>
  placeholder?: string
  supplemental?: ReactNode
  trailingAction?: ReactNode
  type: 'email' | 'password' | 'text'
  value: string
}

export default function AuthFormField({
  autoComplete,
  error,
  hint,
  id,
  label,
  name,
  onBlur,
  onChange,
  placeholder,
  supplemental,
  trailingAction,
  type,
  value,
}: AuthFormFieldProps) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = hint ? `${hintId} ${errorId}` : errorId

  return (
    <div>
      <label
        className="mb-2 block text-sm font-bold text-[#173a2e]"
        htmlFor={id}
      >
        {label}
      </label>
      <div className="relative">
        <input
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          className={`block w-full rounded-xl border border-[#c8d7cf] bg-white px-4 py-3 text-[#173a2e] outline-none transition placeholder:text-[#83958c] focus:border-[#008755] focus:ring-2 focus:ring-[#008755]/15 ${trailingAction ? 'pr-12' : ''}`}
          id={id}
          name={name}
          onBlur={onBlur}
          onChange={onChange}
          placeholder={placeholder}
          type={type}
          value={value}
        />
        {trailingAction ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {trailingAction}
          </div>
        ) : null}
      </div>
      {hint ? (
        <p className="pt-1 text-sm text-[#52675e]" id={hintId}>
          {hint}
        </p>
      ) : null}
      {supplemental}
      <p
        aria-live="polite"
        className="min-h-5 pt-1 text-sm text-rose-600"
        id={errorId}
      >
        {error}
      </p>
    </div>
  )
}
