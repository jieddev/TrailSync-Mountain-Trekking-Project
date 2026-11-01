import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import { useLocation } from 'react-router-dom'

import { useAuth } from '../../../app/AuthContext'
import {
  getCoordinatorSummary,
  type CoordinatorSummary,
} from '../../../lib/coordinator-api'
import { INCIDENT_POLL_MS, usePollingTick } from './use-polling'

// The dashboard counts, shared by the dashboard cards and the navigation
// badges so both come from one poll. `summary` stays at the last good answer
// when a later check fails, so an SOS badge never disappears on a network blip.
export type SummaryState = {
  summary: CoordinatorSummary | null
  failed: boolean
  // Ask again now, e.g. right after confirming a booking.
  refresh: () => void
}

export const CoordinatorSummaryContext = createContext<SummaryState>({
  summary: null,
  failed: false,
  refresh: () => {},
})

export function useCoordinatorSummary() {
  return useContext(CoordinatorSummaryContext)
}

// Polls the summary at the SOS interval while the tab is visible, and asks
// again on every navigation so counts are fresh when a page opens.
export function useCoordinatorSummaryLoader(enabled: boolean): SummaryState {
  const { user } = useAuth()
  const { key: locationKey } = useLocation()
  const tick = usePollingTick(INCIDENT_POLL_MS)
  const [reloadKey, setReloadKey] = useState(0)
  const [summary, setSummary] = useState<CoordinatorSummary | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled || !user) return
    let isCurrent = true
    user
      .getIdToken()
      .then((idToken) => getCoordinatorSummary(idToken))
      .then((next) => {
        if (!isCurrent) return
        setSummary(next)
        setFailed(false)
      })
      .catch(() => {
        if (isCurrent) setFailed(true)
      })
    return () => {
      isCurrent = false
    }
  }, [enabled, user, tick, reloadKey, locationKey])

  const refresh = useCallback(() => setReloadKey((key) => key + 1), [])
  return { summary, failed, refresh }
}
