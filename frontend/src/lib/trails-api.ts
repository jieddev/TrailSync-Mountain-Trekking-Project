import { requestJson } from './api'

export type Money = { amount: number; currency: string }

export type TrailPackage = {
  price: Money
  maximumParticipants: number
  guideCount: number
}

export type PaymentRequirement = Money & { downpaymentPercent: number }

export type Trail = {
  id: string
  slug: string
  name: string
  description: string | null
  package: TrailPackage
  paymentRequirement: PaymentRequirement
}

export async function listTrails() {
  const { items } = await requestJson<{ items: Trail[] }>(
    '/api/v1/trails',
    {},
    'Could not load the trails.',
  )
  return items
}

export function getTrail(trailId: string) {
  return requestJson<Trail>(
    `/api/v1/trails/${encodeURIComponent(trailId)}`,
    {},
    'Could not load this trail.',
  )
}
