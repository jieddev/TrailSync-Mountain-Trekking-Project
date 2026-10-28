import { requestJson } from './api'

// ACTIVE today, UPCOMING, ENDED (its last day has passed) or LIFTED early.
export type TrailRestrictionStatus = 'ACTIVE' | 'UPCOMING' | 'ENDED' | 'LIFTED'

// A closure as hikers see it, from the public trail endpoint.
export type TrailClosure = {
  id: string
  startDate: string
  endDate: string
  reason: string
  status: TrailRestrictionStatus
}

export type TrailRestriction = TrailClosure & {
  trail: { id: string; name: string }
  createdBy: { id: string; fullName: string }
  createdAt: string
  liftedAt: string | null
  liftedBy: { id: string; fullName: string } | null
}

export type CreateTrailRestrictionInput = {
  trailId: string
  startDate: string
  endDate: string
  reason: string
}

// Closures that apply today or later, soonest first. No sign-in needed.
export async function listTrailClosures(trailId: string) {
  const { items } = await requestJson<{ items: TrailClosure[] }>(
    `/api/v1/trails/${encodeURIComponent(trailId)}/restrictions`,
    {},
    'Could not load trail closures.',
  )
  return items
}

const restrictionsPath = '/api/v1/coordinator/trail-restrictions'

export async function listTrailRestrictions(idToken: string) {
  const { items } = await requestJson<{ items: TrailRestriction[] }>(
    restrictionsPath,
    { idToken },
    'Could not load trail restrictions.',
  )
  return items
}

export function createTrailRestriction(
  idToken: string,
  input: CreateTrailRestrictionInput,
) {
  return requestJson<TrailRestriction>(
    restrictionsPath,
    { idToken, method: 'POST', body: input },
    'Could not restrict this trail.',
  )
}

export function liftTrailRestriction(idToken: string, restrictionId: string) {
  return requestJson<TrailRestriction>(
    `${restrictionsPath}/${encodeURIComponent(restrictionId)}/lift`,
    { idToken, method: 'POST' },
    'Could not lift this restriction.',
  )
}

// The closure that applies on a date, if any. The server enforces closures;
// this only lets the booking form warn early.
export function closureOn(closures: TrailClosure[], date: string) {
  return (
    closures.find(
      (closure) => closure.startDate <= date && closure.endDate >= date,
    ) ?? null
  )
}
