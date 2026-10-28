import { useEffect, useState } from 'react'

import {
  listTrailClosures,
  type TrailClosure,
} from '../../../lib/trail-restrictions-api'

// Upcoming closures per trail id. Notices are advisory (the API refuses
// bookings on closed dates), so a trail whose closures fail to load shows none.
export function useTrailClosures(trailIds: string[]) {
  const [closures, setClosures] = useState<Record<string, TrailClosure[]>>({})
  const key = trailIds.join(',')

  useEffect(() => {
    if (!key) return
    let isCurrent = true
    void Promise.all(
      key.split(',').map(async (trailId) => {
        const items = await listTrailClosures(trailId).catch(() => [])
        return [trailId, items] as const
      }),
    ).then((entries) => {
      if (isCurrent) setClosures(Object.fromEntries(entries))
    })
    return () => {
      isCurrent = false
    }
  }, [key])

  return closures
}
