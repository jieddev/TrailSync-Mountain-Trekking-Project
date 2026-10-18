import { Outlet } from 'react-router-dom'

import { useProfile } from '../../../app/ProfileContext'
import StatusCard from '../../booking/components/StatusCard'
import CoordinatorAppShell from './CoordinatorAppShell'

// Rendered only for coordinators; App.tsx redirects every other role.
export default function CoordinatorLayout() {
  const profileState = useProfile()

  return (
    <CoordinatorAppShell
      profile={profileState.status === 'loaded' ? profileState.profile : null}
    >
      {profileState.status === 'loaded' ? (
        <Outlet />
      ) : (
        <StatusCard role="status">Loading your TrailSync profile…</StatusCard>
      )}
    </CoordinatorAppShell>
  )
}
