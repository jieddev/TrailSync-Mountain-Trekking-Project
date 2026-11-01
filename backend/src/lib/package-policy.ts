// Shared package rules for every supported trail. Only the package price varies per trail.
export const MAX_PARTICIPANTS = 5;
// The person who books (and pays) must be an adult; other participants may be minors.
export const MIN_BOOKING_OWNER_AGE = 18;
export const GUIDE_COUNT = 1;
export const DOWNPAYMENT_PERCENT = 50;
export const CURRENCY = "PHP";

export function downpaymentFor(packagePrice: number) {
  return Math.round((packagePrice * DOWNPAYMENT_PERCENT) / 100);
}

export const PAYMENT_OPTIONS = ["DOWNPAYMENT", "FULL"] as const;
export type PaymentOptionValue = (typeof PAYMENT_OPTIONS)[number];

export function isPaymentOption(value: unknown): value is PaymentOptionValue {
  return typeof value === "string" && (PAYMENT_OPTIONS as readonly string[]).includes(value);
}

type PricedBooking = { packagePrice: number; downpaymentAmount: number; paymentOption?: PaymentOptionValue | null };

// What the hiker pays by GCash when booking: the downpayment or the full price.
export function amountDueOnline(booking: PricedBooking) {
  return booking.paymentOption === "FULL" ? booking.packagePrice : booking.downpaymentAmount;
}

// What is left to pay in cash at check-in.
export function balanceDueOnSite(booking: PricedBooking) {
  return booking.packagePrice - amountDueOnline(booking);
}
