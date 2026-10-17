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

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; details?: ApiErrorDetail[] }
    } | null

    throw new ApiError(
      fallbackMessage,
      response.status,
      payload?.error?.code,
      payload?.error?.details ?? [],
    )
  }

  return (await response.json()) as T
}
