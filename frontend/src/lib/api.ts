export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

export type ApiErrorDetail = {
  field: string
  code: string
  message: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details: ApiErrorDetail[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type RequestOptions = {
  idToken?: string
  method?: 'GET' | 'POST'
  body?: unknown
}

async function failure(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: string; details?: ApiErrorDetail[] }
  } | null
  return new ApiError(
    fallbackMessage,
    response.status,
    payload?.error?.code,
    payload?.error?.details ?? [],
  )
}

// Sends multipart form data (e.g. a receipt screenshot). The browser sets the
// Content-Type with its boundary, so it is not set here.
export async function requestForm<T>(
  path: string,
  { idToken, form }: { idToken: string; form: FormData },
  fallbackMessage: string,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: form,
  })
  if (!response.ok) throw await failure(response, fallbackMessage)
  return (await response.json()) as T
}

// Reads a protected file such as a receipt image. An <img> cannot send the
// Authorization header, so callers show the Blob through an object URL.
export async function fetchBlob(
  path: string,
  idToken: string,
  fallbackMessage: string,
): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (!response.ok) throw await failure(response, fallbackMessage)
  return response.blob()
}

// Sends a JSON request to the TrailSync API. Failures become an ApiError with
// the caller's safe message; backend error text is never shown to users.
export async function requestJson<T>(
  path: string,
  { idToken, method = 'GET', body }: RequestOptions,
  fallbackMessage: string,
): Promise<T> {
  const headers: Record<string, string> = {}
  if (idToken) headers.Authorization = `Bearer ${idToken}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!response.ok) throw await failure(response, fallbackMessage)

  return (await response.json()) as T
}
