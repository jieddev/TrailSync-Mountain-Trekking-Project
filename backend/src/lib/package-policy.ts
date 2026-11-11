// Shared package rules for every supported trail. Only the package price varies per trail.
export const MAX_PARTICIPANTS = 5;
// Everyone on a booking must be an adult: the person who books (and pays) and
// each additional participant.
export const MIN_BOOKING_OWNER_AGE = 18;
export const MIN_PARTICIPANT_AGE = 18;
export const GUIDE_COUNT = 1;
export const DOWNPAYMENT_PERCENT = 50;
export const CURRENCY = "PHP";

function downpaymentFor(totalAmount: number) {
  return Math.round((totalAmount * DOWNPAYMENT_PERCENT) / 100);
}

type TrailPricing = { packagePrice: number; garbageFee: number; environmentalFee: number; entranceFeePerPerson: number };

// The price snapshot for a booking of this many participants, or a catalog quote.
export function pricingFor(trail: TrailPricing, participantCount: number) {
  const fees = {
    garbageFee: trail.garbageFee,
    environmentalFee: trail.environmentalFee,
    entranceFee: trail.entranceFeePerPerson * participantCount,
  };
  const totalAmount = trail.packagePrice + fees.garbageFee + fees.environmentalFee + fees.entranceFee;
  return { ...fees, totalAmount, downpaymentAmount: downpaymentFor(totalAmount) };
}

export const PAYMENT_OPTIONS = ["DOWNPAYMENT", "FULL"] as const;
export type PaymentOptionValue = (typeof PAYMENT_OPTIONS)[number];

export function isPaymentOption(value: unknown): value is PaymentOptionValue {
  return typeof value === "string" && (PAYMENT_OPTIONS as readonly string[]).includes(value);
}

type PricedBooking = {
  packagePrice: number;
  garbageFee?: number;
  environmentalFee?: number;
  entranceFee?: number;
  downpaymentAmount: number;
  paymentOption?: PaymentOptionValue | null;
};

// The package price plus the fees snapshotted on the booking.
export function bookingTotal(booking: PricedBooking) {
  return booking.packagePrice + (booking.garbageFee ?? 0) + (booking.environmentalFee ?? 0) + (booking.entranceFee ?? 0);
}

// What the hiker pays by GCash when booking: the downpayment or the full total.
export function amountDueOnline(booking: PricedBooking) {
  return booking.paymentOption === "FULL" ? bookingTotal(booking) : booking.downpaymentAmount;
}

// What is left to pay in cash at check-in.
export function balanceDueOnSite(booking: PricedBooking) {
  return bookingTotal(booking) - amountDueOnline(booking);
}
