import type { Prisma } from "@prisma/client";

// The guide representation shared by coordinator and guide routes.
export const guideSelect = {
  id: true,
  dutyStatus: true,
  availableSince: true,
  user: { select: { fullName: true, email: true } },
  bookings: {
    where: { status: "GUIDE_ASSIGNED" },
    select: { id: true, scheduledDate: true, scheduledTime: true, trail: { select: { id: true, name: true } } },
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
      ? { id: current.id, trail: { id: current.trail.id, name: current.trail.name }, scheduledDate: current.scheduledDate, scheduledTime: current.scheduledTime }
      : null,
  };
}
