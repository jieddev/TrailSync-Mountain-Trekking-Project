type AuthSubmitButtonProps = {
  isLoading?: boolean
  label: string
}

export default function AuthSubmitButton({
  isLoading = false,
  label,
}: AuthSubmitButtonProps) {
  return (
    <button
      aria-busy={isLoading}
      className="mt-2 flex w-full items-center justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isLoading}
      type="submit"
    >
      {isLoading ? 'Please wait…' : label}
    </button>
  )
}
