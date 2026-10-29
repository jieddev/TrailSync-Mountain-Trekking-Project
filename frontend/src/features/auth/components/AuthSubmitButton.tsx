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
      className="mt-2 flex w-full items-center justify-center rounded-xl bg-[#008755] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#006b43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008755] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isLoading}
      type="submit"
    >
      {isLoading ? 'Please wait…' : label}
    </button>
  )
}
