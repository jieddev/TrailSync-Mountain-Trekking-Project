import { requestJson } from './api'

export type Money = { amount: number; currency: string }

export type TrailPackage = {
  price: Money
  maximumParticipants: number
  guideCount: number
}

// Where hikers send their GCash payment. Test mode: no money moves through
// TrailSync and the coordinator checks the uploaded screenshot by eye.
export type PaymentMethod = {
  provider: 'GCASH'
  accountName: string
  accountNumber: string
  // Served by this web app from /public.
  qrImagePath: string
  testMode: boolean
}

export type PaymentRequirement = Money & { downpaymentPercent: number }

// The trail catalog also offers paying the full price up front. Amounts quote
// a one-hiker booking, since the entrance fee depends on group size.
export type TrailPaymentRequirement = PaymentRequirement & {
  fullAmount: number
  method: PaymentMethod
}

// Added to the package price, once per booking except the per-person entrance.
export type TrailFees = {
  garbage: number
  environmental: number
  entrancePerPerson: number
}

export type Trail = {
  id: string
  slug: string
  name: string
  description: string | null
  package: TrailPackage
  fees: TrailFees
  paymentRequirement: TrailPaymentRequirement
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
