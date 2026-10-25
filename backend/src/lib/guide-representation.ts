import type { Prisma } from "@prisma/client";

import { ACTIVE_TREK_STATUSES } from "./guide-queue.js";

// The guide representation shared by coordinator and guide routes.
export const guideSelect = {
  id: true,
  dutyStatus: true,
  availableSince: true,
  user: { select: { fullName: true, email: true } },
  bookings: {
    where: { status: { in: ACTIVE_TREK_STATUSES } },
    select: { id: true, status: true, scheduledDate: true, scheduledTime: true, trail: { select: { id: true, name: true } } },
    take: 1,
  },
} satisfies Prisma.GuideSelect;

export function guideResponse(guide: any, queuePosition: number | null) {
  const current = guide.bookings[0];
  return {
    id: guide.id,
    fullName: guide.user.fullName,
    email: guide.user.email,
    dutyStatus: guide.dutyStatus,
    availableSince: guide.availableSince,
    queuePosition,
    currentBooking: current
      ? { id: current.id, status: current.status, trail: { id: current.trail.id, name: current.trail.name }, scheduledDate: current.scheduledDate, scheduledTime: current.scheduledTime }
      : null,
  };
}
