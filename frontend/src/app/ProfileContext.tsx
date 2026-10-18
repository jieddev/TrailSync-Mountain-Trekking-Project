import { createContext, useContext } from 'react'

import type { CurrentUserProfile } from '../lib/users-api'

// The signed-in user's TrailSync profile from GET /api/v1/users/me. The role
// only drives navigation; the API still enforces it on every request.
export type ProfileState =
  | { status: 'signed-out' }
  | { status: 'loading' }
  | { status: 'loaded'; profile: CurrentUserProfile }
  | { status: 'missing' }
  | { status: 'error' }

export const ProfileContext = createContext<ProfileState>({
  status: 'loading',
})

export function useProfile() {
  return useContext(ProfileContext)
}
