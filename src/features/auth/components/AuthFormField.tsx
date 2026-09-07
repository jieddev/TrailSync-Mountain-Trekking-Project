type AuthFormFieldProps = {
  autoComplete: string
  id: string
  label: string
  type: 'email' | 'password' | 'text'
}

export default function AuthFormField({
  autoComplete,
  id,
  label,
  type,
}: AuthFormFieldProps) {
  const errorId = `${id}-error`

  return (
    <div>
      <label
        className="mb-2 block text-sm font-medium text-slate-200"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        aria-describedby={errorId}
        autoComplete={autoComplete}
        className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/25"
        id={id}
        name={id}
        type={type}
      />
      <p
        aria-live="polite"
        className="min-h-5 pt-1 text-sm text-rose-300"
        id={errorId}
      />
    </div>
  )
}
