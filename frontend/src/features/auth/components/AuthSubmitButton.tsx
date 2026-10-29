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
      className="mt-2 flex w-full cursor-pointer items-center justify-center rounded-xl bg-[#477a69] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#3a6457] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008755] disabled:cursor-not-allowed"
      disabled={isLoading}
      type="submit"
    >
      {isLoading ? (
        <>
          <span
            aria-hidden="true"
            className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
          />
          <span className="sr-only">Please wait…</span>
        </>
      ) : (
        label
      )}
    </button>
  )
}
