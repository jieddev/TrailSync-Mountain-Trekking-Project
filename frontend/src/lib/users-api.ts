const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

type CreateUserInput = {
  fullName: string
  idToken: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function createUser({ idToken, ...user }: CreateUserInput) {
  const response = await fetch(`${apiBaseUrl}/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(user),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string
    } | null

    throw new ApiError(
      payload?.message ?? 'Could not save your TrailSync profile.',
      response.status,
    )
  }
}
