import { useEffect, useState } from 'react'

type ReceiptImageProps = {
  // Fetches the protected image with the caller's token.
  load: () => Promise<Blob>
  // Identifies the image (the receipt id); the image reloads when it changes.
  imageKey: string
  alt: string
  className?: string
}

type ImageState =
  | { status: 'loading' }
  | { status: 'loaded'; url: string }
  | { status: 'error' }

// Shows a receipt screenshot from a protected API route. Click to enlarge.
export default function ReceiptImage({
  load,
  imageKey,
  alt,
  className = 'h-40 w-28',
}: ReceiptImageProps) {
  const [state, setState] = useState<ImageState>({ status: 'loading' })
  const [isEnlarged, setIsEnlarged] = useState(false)

  useEffect(() => {
    let url = ''
    let isCurrent = true
    load()
      .then((blob) => {
        url = URL.createObjectURL(blob)
        if (isCurrent) setState({ status: 'loaded', url })
        else URL.revokeObjectURL(url)
      })
      .catch(() => {
        if (isCurrent) setState({ status: 'error' })
      })
    return () => {
      isCurrent = false
      if (url) URL.revokeObjectURL(url)
    }
    // `load` is recreated each render; reload only when the image changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey])

  useEffect(() => {
    if (!isEnlarged) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsEnlarged(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [isEnlarged])

  if (state.status !== 'loaded') {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-md border border-[#e7ece8] bg-[#f3f6f2] p-2 text-center text-xs text-[#70857b] ${className}`}
        role={state.status === 'error' ? 'alert' : 'status'}
      >
        {state.status === 'loading' ? 'Loading image…' : 'Image unavailable'}
      </div>
    )
  }

  return (
    <>
      <button
        aria-label={`Enlarge ${alt}`}
        className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]"
        onClick={() => setIsEnlarged(true)}
        type="button"
      >
        <img
          alt={alt}
          className={`rounded-md border border-[#e7ece8] bg-white object-cover ${className}`}
          src={state.url}
        />
      </button>
      {isEnlarged && (
        <div
          aria-label={alt}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setIsEnlarged(false)}
          role="dialog"
        >
          <img
            alt={alt}
            className="max-h-full max-w-full rounded-lg bg-white object-contain"
            src={state.url}
          />
          <button
            className="absolute right-4 top-4 rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#173a2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008755]"
            onClick={() => setIsEnlarged(false)}
            type="button"
          >
            Close
          </button>
        </div>
      )}
    </>
  )
}
