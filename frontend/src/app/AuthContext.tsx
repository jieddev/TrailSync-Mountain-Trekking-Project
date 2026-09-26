import type { User } from 'firebase/auth'
import { createContext, useContext } from 'react'

export type AuthState = { user: User | null; isLoading: boolean }
export const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
})

export function useAuth() {
  return useContext(AuthContext)
}
