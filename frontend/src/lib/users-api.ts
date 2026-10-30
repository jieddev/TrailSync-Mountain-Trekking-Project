import { ApiError, apiBaseUrl } from './api'

export { ApiError }

type CreateUserInput = {
  acceptedTermsVersion: string
  fullName: string
  idToken: string
}

export type CurrentUserProfile = {
  id: string
  fullName: string
  email: string
  role: string
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

export async function getCurrentUserProfile(idToken: string) {
  const response = await fetch(`${apiBaseUrl}/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string }
    } | null

    throw new ApiError(
      'Could not load your TrailSync profile.',
      response.status,
      payload?.error?.code,
    )
  }

  return (await response.json()) as CurrentUserProfile
}
