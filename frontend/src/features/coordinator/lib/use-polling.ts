import { useEffect, useState } from 'react'

// SOS alerts must reach the coordinator without a page reload, so the
// incident screens ask again on this interval.
export const INCIDENT_POLL_MS = 20_000

// A counter that goes up every [intervalMs] while the tab is visible, and as
// soon as a hidden tab becomes visible again. Add it to an effect's
// dependencies to reload on the interval.
export function usePollingTick(intervalMs: number) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const bump = () => {
      if (!document.hidden) setTick((value) => value + 1)
    }
    const timer = window.setInterval(bump, intervalMs)
    document.addEventListener('visibilitychange', bump)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', bump)
    }
  }, [intervalMs])

  return tick
}
