import type { BookingStatus, Prisma } from "@prisma/client";

// FIFO guide dispatch rules (PROJECT_CONTEXT.md §5.3). The queue is the AVAILABLE
// guides ordered by when they became available; dispatch always takes the front
// guide, with no skipping. Every function here takes the queue lock first, so
// concurrent check-ins are handled one at a time and can never assign one guide
// to two groups. The partial unique index bookings_one_active_trek_per_guide is
// the database backstop for the same rule.

type Tx = Prisma.TransactionClient;
export type AvailabilityStatus = "AVAILABLE" | "OFF_DUTY";

// A guide's trek is active from dispatch until completion, whether or not the
// guide has started it from the app yet.
export const ACTIVE_TREK_STATUSES = ["GUIDE_ASSIGNED", "IN_PROGRESS"] satisfies BookingStatus[];

// Arbitrary application-wide key for pg_advisory_xact_lock. The lock is released
// when the transaction ends, and the same transaction can take it more than once.
const GUIDE_QUEUE_LOCK_KEY = 5_310_001;

export const queueOrder = [{ availableSince: "asc" }, { id: "asc" }] satisfies Prisma.GuideOrderByWithRelationInput[];

export async function lockGuideQueue(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GUIDE_QUEUE_LOCK_KEY}::bigint)`;
}

// Assigns the guide at the front of the queue to a CHECKED_IN booking. Returns
// null when no guide is available, leaving the booking waiting in CHECKED_IN.
export async function dispatchFrontGuide(tx: Tx, bookingId: string, now = new Date()) {
  await lockGuideQueue(tx);
  const front = await tx.guide.findFirst({ where: { dutyStatus: "AVAILABLE" }, orderBy: queueOrder, select: { id: true } });
  if (!front) return null;
  const claimed = await tx.guide.updateMany({
    where: { id: front.id, dutyStatus: "AVAILABLE" },
    data: { dutyStatus: "ASSIGNED", availableSince: null },
  });
  const assigned = await tx.booking.updateMany({
    where: { id: bookingId, status: "CHECKED_IN" },
    data: { status: "GUIDE_ASSIGNED", guideId: front.id, guideAssignedAt: now },
  });
  // Both rows are guarded by the lock and the caller's checks; a miss means the
  // invariant broke, so throw to roll the whole transaction back.
  if (!claimed.count || !assigned.count) throw new Error("Guide dispatch lost its guide or booking inside the queue lock.");
  return front;
}

// Completes the trek and sends the guide to the end of the queue. The coordinator
// can complete a trek the guide never started (e.g. a dead phone), so both active
// statuses are accepted here; the guide's own rule is in guide-treks.ts.
export async function completeTrek(tx: Tx, bookingId: string, now = new Date()) {
  await lockGuideQueue(tx);
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { status: true, guideId: true } });
  if (!booking) return "BOOKING_NOT_FOUND" as const;
  if (!isActiveTrek(booking.status) || !booking.guideId) return "BOOKING_NOT_ON_TREK" as const;
  await tx.booking.update({ where: { id: bookingId }, data: { status: "COMPLETED", completedAt: now } });
  const released = await tx.guide.updateMany({
    where: { id: booking.guideId, dutyStatus: "ASSIGNED" },
    data: { dutyStatus: "AVAILABLE", availableSince: now },
  });
  if (!released.count) throw new Error("The completed trek's guide was not ASSIGNED.");
  return null;
}

// Reporting in puts a guide at the end of the queue; going off duty removes them.
// Repeating the current state is a no-op, so an AVAILABLE guide keeps their place.
// A guide on an assigned trek cannot change state until the trek is completed.
export async function setAvailability(tx: Tx, guideId: string, status: AvailabilityStatus, now = new Date()) {
  await lockGuideQueue(tx);
  const guide = await tx.guide.findUnique({ where: { id: guideId }, select: { dutyStatus: true } });
  if (!guide) return "GUIDE_NOT_FOUND" as const;
  if (guide.dutyStatus === "ASSIGNED") return "GUIDE_ON_TREK" as const;
  if (guide.dutyStatus !== status) {
    await tx.guide.update({ where: { id: guideId }, data: { dutyStatus: status, availableSince: status === "AVAILABLE" ? now : null } });
  }
  return null;
}

// 1-based place in the queue, or null when the guide is not AVAILABLE.
export async function queuePosition(tx: Tx, guide: { id: string; dutyStatus: string; availableSince: Date | null }) {
  if (guide.dutyStatus !== "AVAILABLE" || !guide.availableSince) return null;
  const ahead = await tx.guide.count({
    where: {
      dutyStatus: "AVAILABLE",
      OR: [{ availableSince: { lt: guide.availableSince } }, { availableSince: guide.availableSince, id: { lt: guide.id } }],
    },
  });
  return ahead + 1;
}

export function isActiveTrek(status: BookingStatus) {
  return (ACTIVE_TREK_STATUSES as BookingStatus[]).includes(status);
}
