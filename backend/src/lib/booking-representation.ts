import type { Prisma, PrismaClient } from "@prisma/client";

import { CURRENCY, DOWNPAYMENT_PERCENT, GUIDE_COUNT, MAX_PARTICIPANTS, amountDueOnline, balanceDueOnSite, bookingTotal } from "./package-policy.js";
import { paymentMethod } from "./payment-config.js";
import { restrictionsForBookings } from "./trail-restrictions.js";

// Owner first, then additional participants, then walk-ins added at check-in.
export const bookingInclude = {
  participants: { orderBy: [{ kind: "asc" }, { id: "asc" }] },
  trail: { select: { id: true, name: true } },
  guide: { select: { id: true, user: { select: { fullName: true } } } },
  // Newest first, so the first receipt is the one awaiting review.
  paymentReceipts: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.BookingInclude;

// The booking representation in API_CONTRACT_V1.md §4, shared by hiker and coordinator routes.
export function bookingResponse(booking: any) {
  const participants = booking.participants.map((participant: any) => ({
    id: participant.id,
    kind: participant.kind,
    name: participant.name,
    age: participant.age,
    address: participant.address,
    email: participant.email ?? null,
    attendance: participant.attendance ?? null,
    certificateSentAt: participant.certificateSentAt ?? null,
  }));
  return {
    id: booking.id,
    trail: { id: booking.trail.id, name: booking.trail.name },
    scheduledDate: booking.scheduledDate,
    scheduledTime: booking.scheduledTime,
    status: booking.status,
    downpaymentStatus: booking.downpaymentStatus,
    participants,
    participantCount: participants.length,
    guide: booking.guide ? { id: booking.guide.id, fullName: booking.guide.user.fullName } : null,
    checkedInAt: booking.checkedInAt ?? null,
    guideAssignedAt: booking.guideAssignedAt ?? null,
    trekStartedAt: booking.trekStartedAt ?? null,
    completedAt: booking.completedAt ?? null,
    package: { price: { amount: booking.packagePrice, currency: CURRENCY }, maximumParticipants: MAX_PARTICIPANTS, guideCount: GUIDE_COUNT },
    paymentRequirement: { downpaymentPercent: DOWNPAYMENT_PERCENT, amount: booking.downpaymentAmount, currency: CURRENCY },
    payment: paymentResponse(booking),
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

// GCash payment details (test mode). The stored file name is never exposed;
// images are read through the receipt file routes.
function paymentResponse(booking: any) {
  const option = booking.paymentOption ?? "DOWNPAYMENT";
  return {
    option,
    currency: CURRENCY,
    fees: { garbage: booking.garbageFee ?? 0, environmental: booking.environmentalFee ?? 0, entrance: booking.entranceFee ?? 0 },
    totalAmount: bookingTotal(booking),
    amountDueOnline: amountDueOnline({ ...booking, paymentOption: option }),
    balanceDueOnSite: balanceDueOnSite({ ...booking, paymentOption: option }),
    balanceCollectedAt: booking.balanceCollectedAt ?? null,
    method: paymentMethod(),
    receipts: (booking.paymentReceipts ?? []).map((receipt: any) => ({
      id: receipt.id,
      amount: receipt.amount,
      referenceNumber: receipt.referenceNumber ?? null,
      status: receipt.status,
      rejectionReason: receipt.rejectionReason ?? null,
      reviewedAt: receipt.reviewedAt ?? null,
      createdAt: receipt.createdAt,
    })),
  };
}

// Adds trailRestriction (the restriction closing the booking's trail on its
// date, or null) to each booking representation, using one query for the list.
export async function withTrailRestrictions<T extends { trail: { id: string }; scheduledDate: string }>(
  db: Prisma.TransactionClient | PrismaClient,
  bookings: T[],
  respond: (booking: T) => object = bookingResponse,
) {
  const restrictionFor = await restrictionsForBookings(db, bookings);
  return bookings.map((booking) => ({ ...respond(booking), trailRestriction: restrictionFor(booking) }));
}

export async function withTrailRestriction<T extends { trail: { id: string }; scheduledDate: string }>(
  db: Prisma.TransactionClient | PrismaClient,
  booking: T,
  respond: (booking: T) => object = bookingResponse,
) {
  return (await withTrailRestrictions(db, [booking], respond))[0];
}
