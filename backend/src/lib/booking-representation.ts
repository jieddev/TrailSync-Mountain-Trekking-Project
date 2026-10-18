import { CURRENCY, DOWNPAYMENT_PERCENT, GUIDE_COUNT, MAX_PARTICIPANTS } from "./package-policy.js";

export const bookingInclude = { participants: true, trail: { select: { id: true, name: true } } } as const;

// The booking representation in API_CONTRACT_V1.md §4, shared by hiker and coordinator routes.
export function bookingResponse(booking: any) {
  const participants = booking.participants.map((participant: any) => ({
    id: participant.id,
    kind: participant.kind,
    name: participant.name,
    age: participant.age,
    address: participant.address,
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
    package: { price: { amount: booking.packagePrice, currency: CURRENCY }, maximumParticipants: MAX_PARTICIPANTS, guideCount: GUIDE_COUNT },
    paymentRequirement: { downpaymentPercent: DOWNPAYMENT_PERCENT, amount: booking.downpaymentAmount, currency: CURRENCY },
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}
