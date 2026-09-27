import { onAuthStateChanged } from 'firebase/auth'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import LoginPage from '../features/auth/pages/LoginPage'
import RegisterPage from '../features/auth/pages/RegisterPage'
import HikerHomePage from '../features/home/pages/HikerHomePage'
import { AuthContext, type AuthState, useAuth } from './AuthContext'
import { auth } from '../lib/firebase'

function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isLoading: true })

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => setState({ user, isLoading: false })),
    [],
  )

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

function ProtectedHome() {
  const { user, isLoading } = useAuth()
  if (isLoading)
    return (
      <main className="grid min-h-screen place-items-center text-sm text-[#52675e]">
        Loading your TrailSync account…
      </main>
    )
  return user ? <HikerHomePage /> : <Navigate to="/login" replace />
}

function LoginRoute() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  return user ? <Navigate to="/home" replace /> : <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/home" element={<ProtectedHome />} />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AuthProvider>
  )
}
