import { onAuthStateChanged } from 'firebase/auth'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import LoginPage from '../features/auth/pages/LoginPage'
import RegisterPage from '../features/auth/pages/RegisterPage'
import BookingDetailPage from '../features/booking/pages/BookingDetailPage'
import BookingFormPage from '../features/booking/pages/BookingFormPage'
import MyBookingsPage from '../features/booking/pages/MyBookingsPage'
import TrailsPage from '../features/booking/pages/TrailsPage'
import HikerLayout from '../features/home/components/HikerLayout'
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

function ProtectedHikerLayout() {
  const { user, isLoading } = useAuth()
  if (isLoading)
    return (
      <main className="grid min-h-screen place-items-center text-sm text-[#52675e]">
        Loading your TrailSync account…
      </main>
    )
  return user ? <HikerLayout /> : <Navigate to="/login" replace />
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
        <Route element={<ProtectedHikerLayout />}>
          <Route path="/home" element={<HikerHomePage />} />
          <Route path="/trails" element={<TrailsPage />} />
          <Route path="/bookings" element={<MyBookingsPage />} />
          <Route path="/bookings/new" element={<BookingFormPage />} />
          <Route path="/bookings/:bookingId" element={<BookingDetailPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AuthProvider>
  )
}
