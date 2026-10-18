import { onAuthStateChanged, type User } from 'firebase/auth'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import LoginPage from '../features/auth/pages/LoginPage'
import RegisterPage from '../features/auth/pages/RegisterPage'
import BookingDetailPage from '../features/booking/pages/BookingDetailPage'
import BookingFormPage from '../features/booking/pages/BookingFormPage'
import MyBookingsPage from '../features/booking/pages/MyBookingsPage'
import TrailsPage from '../features/booking/pages/TrailsPage'
import CoordinatorLayout from '../features/coordinator/components/CoordinatorLayout'
import BookingQueuePage from '../features/coordinator/pages/BookingQueuePage'
import CoordinatorBookingDetailPage from '../features/coordinator/pages/CoordinatorBookingDetailPage'
import GuideApplicationsPage from '../features/coordinator/pages/GuideApplicationsPage'
import HikerLayout from '../features/home/components/HikerLayout'
import HikerHomePage from '../features/home/pages/HikerHomePage'
import { AuthContext, type AuthState, useAuth } from './AuthContext'
import { ProfileContext, type ProfileState, useProfile } from './ProfileContext'
import {
  coordinatorHomePath,
  hikerHomePath,
  homePathForRole,
} from './role-routes'
import { auth } from '../lib/firebase'
import { ApiError, getCurrentUserProfile } from '../lib/users-api'

function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isLoading: true })

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => setState({ user, isLoading: false })),
    [],
  )

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

// Loads the TrailSync profile once per signed-in Firebase user so every route
// knows the role before choosing a layout.
function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loaded, setLoaded] = useState<{
    user: User
    state: ProfileState
  } | null>(null)

  useEffect(() => {
    if (!user) return
    let isCurrent = true

    async function loadProfile() {
      try {
        const profile = await getCurrentUserProfile(await user!.getIdToken())
        if (isCurrent)
          setLoaded({ user: user!, state: { status: 'loaded', profile } })
      } catch (error) {
        if (!isCurrent) return
        setLoaded({
          user: user!,
          state: {
            status:
              error instanceof ApiError &&
              error.status === 404 &&
              error.code === 'PROFILE_NOT_FOUND'
                ? 'missing'
                : 'error',
          },
        })
      }
    }

    void loadProfile()
    return () => {
      isCurrent = false
    }
  }, [user])

  // A result for an earlier sign-in is never shown to the next one, even for
  // the same account (registration reads /users/me before the profile exists).
  const state: ProfileState = !user
    ? { status: 'signed-out' }
    : loaded?.user === user
      ? loaded.state
      : { status: 'loading' }

  return (
    <ProfileContext.Provider value={state}>{children}</ProfileContext.Provider>
  )
}

const loadingAccount = (
  <main className="grid min-h-screen place-items-center text-sm text-[#52675e]">
    Loading your TrailSync account…
  </main>
)

// Role checks here only choose what to show; the API enforces every role.
function ProtectedHikerLayout() {
  const { user, isLoading } = useAuth()
  const profile = useProfile()
  if (isLoading) return loadingAccount
  if (!user) return <Navigate to="/login" replace />
  if (profile.status === 'loaded' && profile.profile.role === 'COORDINATOR')
    return <Navigate to={coordinatorHomePath} replace />
  return <HikerLayout />
}

function ProtectedCoordinatorLayout() {
  const { user, isLoading } = useAuth()
  const profile = useProfile()
  if (isLoading) return loadingAccount
  if (!user) return <Navigate to="/login" replace />
  if (profile.status === 'loading') return loadingAccount
  if (profile.status !== 'loaded' || profile.profile.role !== 'COORDINATOR')
    return <Navigate to={hikerHomePath} replace />
  return <CoordinatorLayout />
}

function RoleHome() {
  const { user, isLoading } = useAuth()
  const profile = useProfile()
  if (isLoading) return loadingAccount
  if (!user) return <Navigate to="/login" replace />
  if (profile.status === 'loading') return loadingAccount
  return (
    <Navigate
      to={
        profile.status === 'loaded'
          ? homePathForRole(profile.profile.role)
          : hikerHomePath
      }
      replace
    />
  )
}

function LoginRoute() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  return user ? <Navigate to="/" replace /> : <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedHikerLayout />}>
            <Route path="/home" element={<HikerHomePage />} />
            <Route path="/trails" element={<TrailsPage />} />
            <Route path="/bookings" element={<MyBookingsPage />} />
            <Route path="/bookings/new" element={<BookingFormPage />} />
            <Route
              path="/bookings/:bookingId"
              element={<BookingDetailPage />}
            />
          </Route>
          <Route path="/coordinator" element={<ProtectedCoordinatorLayout />}>
            <Route index element={<Navigate to="bookings" replace />} />
            <Route path="bookings" element={<BookingQueuePage />} />
            <Route
              path="bookings/:bookingId"
              element={<CoordinatorBookingDetailPage />}
            />
            <Route
              path="guide-applications"
              element={<GuideApplicationsPage />}
            />
          </Route>
          <Route path="/" element={<RoleHome />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ProfileProvider>
    </AuthProvider>
  )
}
