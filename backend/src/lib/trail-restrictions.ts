import type { Prisma, PrismaClient } from "@prisma/client";

// Trail restrictions (PROJECT_MILESTONES.md Phase 8). A coordinator closes a
// trail for an inclusive range of Asia/Manila dates. Weather is advisory only:
// nothing here restricts a trail automatically, because the official weather
// thresholds are not decided yet.

type Db = Prisma.TransactionClient | PrismaClient;

export const restrictionSelect = {
  id: true,
  trailId: true,
  startDate: true,
  endDate: true,
  reason: true,
  liftedAt: true,
  createdAt: true,
  trail: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
  liftedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.TrailRestrictionSelect;

type DateRange = { startDate: string; endDate: string; reason: string };

// YYYY-MM-DD strings compare correctly as text.
const covers = (restriction: { startDate: string; endDate: string }, date: string) =>
  restriction.startDate <= date && restriction.endDate >= date;

// The restriction (if any) that closes this trail on this date.
export function activeRestriction(db: Db, trailId: string, date: string) {
  return db.trailRestriction.findFirst({
    where: { trailId, liftedAt: null, startDate: { lte: date }, endDate: { gte: date } },
    select: { startDate: true, endDate: true, reason: true },
    orderBy: { startDate: "asc" },
  });
}

type DatedBooking = { trail: { id: string }; scheduledDate: string };

// Looks up the restriction for each booking's trail and date with one query, so
// booking lists can show it without a query per booking.
export async function restrictionsForBookings(db: Db, bookings: DatedBooking[]) {
  if (!bookings.length) return () => null;
  const dates = bookings.map((booking) => booking.scheduledDate).sort();
  const restrictions = await db.trailRestriction.findMany({
    where: {
      trailId: { in: [...new Set(bookings.map((booking) => booking.trail.id))] },
      liftedAt: null,
      startDate: { lte: dates[dates.length - 1] },
      endDate: { gte: dates[0] },
    },
    select: { trailId: true, startDate: true, endDate: true, reason: true },
    orderBy: { startDate: "asc" },
  });
  return (booking: DatedBooking): DateRange | null => {
    const match = restrictions.find((restriction) => restriction.trailId === booking.trail.id && covers(restriction, booking.scheduledDate));
    return match ? { startDate: match.startDate, endDate: match.endDate, reason: match.reason } : null;
  };
}

// ACTIVE today, UPCOMING, ENDED (its last day has passed) or LIFTED early by a coordinator.
export function restrictionStatus(restriction: { startDate: string; endDate: string; liftedAt: Date | null }, today: string) {
  if (restriction.liftedAt) return "LIFTED" as const;
  if (restriction.endDate < today) return "ENDED" as const;
  if (restriction.startDate > today) return "UPCOMING" as const;
  return "ACTIVE" as const;
}

export function restrictionResponse(restriction: any, today: string) {
  return {
    id: restriction.id,
    trail: { id: restriction.trail.id, name: restriction.trail.name },
    startDate: restriction.startDate,
    endDate: restriction.endDate,
    reason: restriction.reason,
    status: restrictionStatus(restriction, today),
    createdBy: { id: restriction.createdBy.id, fullName: restriction.createdBy.fullName },
    createdAt: restriction.createdAt,
    liftedAt: restriction.liftedAt ?? null,
    liftedBy: restriction.liftedBy ? { id: restriction.liftedBy.id, fullName: restriction.liftedBy.fullName } : null,
  };
}

// What hikers see: no coordinator names.
export function publicRestrictionResponse(restriction: any, today: string) {
  return {
    id: restriction.id,
    startDate: restriction.startDate,
    endDate: restriction.endDate,
    reason: restriction.reason,
    status: restrictionStatus(restriction, today),
  };
}
