import { Outlet } from 'react-router-dom'

import { useProfile } from '../../../app/ProfileContext'
import StatusCard from '../../booking/components/StatusCard'
import {
  CoordinatorSummaryContext,
  useCoordinatorSummaryLoader,
} from '../lib/coordinator-summary'
import CoordinatorAppShell from './CoordinatorAppShell'

// Rendered only for coordinators; App.tsx redirects every other role.
export default function CoordinatorLayout() {
  const profileState = useProfile()
  const loaded = profileState.status === 'loaded'
  const summaryState = useCoordinatorSummaryLoader(loaded)

  return (
    <CoordinatorSummaryContext.Provider value={summaryState}>
      <CoordinatorAppShell profile={loaded ? profileState.profile : null}>
        {loaded ? (
          <Outlet />
        ) : (
          <StatusCard role="status">Loading your TrailSync profile…</StatusCard>
        )}
      </CoordinatorAppShell>
    </CoordinatorSummaryContext.Provider>
  )
}
