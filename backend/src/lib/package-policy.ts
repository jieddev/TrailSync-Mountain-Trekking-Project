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
