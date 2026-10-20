import type { Prisma } from "@prisma/client";

import { CURRENCY, DOWNPAYMENT_PERCENT, GUIDE_COUNT, MAX_PARTICIPANTS } from "./package-policy.js";

// Owner first, then additional participants, then walk-ins added at check-in.
export const bookingInclude = {
  participants: { orderBy: [{ kind: "asc" }, { id: "asc" }] },
  trail: { select: { id: true, name: true } },
  guide: { select: { id: true, user: { select: { fullName: true } } } },
} satisfies Prisma.BookingInclude;

// The booking representation in API_CONTRACT_V1.md §4, shared by hiker and coordinator routes.
export function bookingResponse(booking: any) {
  const participants = booking.participants.map((participant: any) => ({
    id: participant.id,
    kind: participant.kind,
    name: participant.name,
    age: participant.age,
    address: participant.address,
    attendance: participant.attendance ?? null,
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
    completedAt: booking.completedAt ?? null,
    package: { price: { amount: booking.packagePrice, currency: CURRENCY }, maximumParticipants: MAX_PARTICIPANTS, guideCount: GUIDE_COUNT },
    paymentRequirement: { downpaymentPercent: DOWNPAYMENT_PERCENT, amount: booking.downpaymentAmount, currency: CURRENCY },
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}
