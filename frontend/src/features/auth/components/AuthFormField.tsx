import type { ChangeEventHandler } from 'react'

type AuthFormFieldProps = {
  autoComplete: string
  error?: string
  hint?: string
  id: string
  label: string
  name: string
  onChange: ChangeEventHandler<HTMLInputElement>
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
  onChange,
  type,
  value,
}: AuthFormFieldProps) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = hint ? `${hintId} ${errorId}` : errorId

  return (
    <div>
      <label
        className="mb-2 block text-sm font-medium text-slate-200"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/25"
        id={id}
        name={name}
        onChange={onChange}
        type={type}
        value={value}
      />
      {hint ? (
        <p className="pt-1 text-sm text-slate-400" id={hintId}>
          {hint}
        </p>
      ) : null}
      <p
        aria-live="polite"
        className="min-h-5 pt-1 text-sm text-rose-300"
        id={errorId}
      >
        {error}
      </p>
    </div>
  )
}
