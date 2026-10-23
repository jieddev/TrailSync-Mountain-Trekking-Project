import type { Prisma } from "@prisma/client";

import { completeTrek, lockGuideQueue } from "./guide-queue.js";

// Trek session rules for the guide app (PROJECT_CONTEXT.md §6). A dispatched
// group's guide starts the trek (GUIDE_ASSIGNED → IN_PROGRESS) and completes it
// (IN_PROGRESS → COMPLETED). A guide only ever sees their own treks: someone
// else's booking is reported as not found.

type Tx = Prisma.TransactionClient;

// The guide's duty state stays ASSIGNED, so starting needs no queue lock; the
// guarded update is enough to make a repeated start harmless.
export async function startTrek(tx: Tx, guideId: string, bookingId: string, now = new Date()) {
  const started = await tx.booking.updateMany({
    where: { id: bookingId, guideId, status: "GUIDE_ASSIGNED" },
    data: { status: "IN_PROGRESS", trekStartedAt: now },
  });
  if (started.count) return null;
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { guideId: true } });
  if (!booking || booking.guideId !== guideId) return "BOOKING_NOT_FOUND" as const;
  return "TREK_NOT_STARTABLE" as const;
}

// The guide completes only a trek they started; the coordinator's fallback in
// completeTrek also accepts one that was never started.
export async function completeOwnTrek(tx: Tx, guideId: string, bookingId: string, now = new Date()) {
  await lockGuideQueue(tx);
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { status: true, guideId: true } });
  if (!booking || booking.guideId !== guideId) return "BOOKING_NOT_FOUND" as const;
  if (booking.status !== "IN_PROGRESS") return "TREK_NOT_IN_PROGRESS" as const;
  return completeTrek(tx, bookingId, now);
}
