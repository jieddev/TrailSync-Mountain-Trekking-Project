import { useEffect, useState } from 'react'

import { useAuth } from '../../../app/AuthContext'
import { listIncidents } from '../../../lib/incidents-api'
import { INCIDENT_POLL_MS, usePollingTick } from './use-polling'

// How many SOS alerts nobody has acknowledged yet, for the navigation badge.
// A failed check keeps the last count rather than hiding an alert.
export function useOpenIncidentCount(enabled: boolean) {
  const { user } = useAuth()
  const [count, setCount] = useState(0)
  const tick = usePollingTick(INCIDENT_POLL_MS)

  useEffect(() => {
    if (!enabled || !user) return
    let isCurrent = true
    user
      .getIdToken()
      .then((idToken) => listIncidents(idToken, 'OPEN'))
      .then((items) => {
        if (isCurrent) setCount(items.length)
      })
      .catch(() => {})
    return () => {
      isCurrent = false
    }
  }, [enabled, user, tick])

  return count
}
