import type { Prisma } from "@prisma/client";

import { accuracyDetails, coordinateDetails, finite } from "./geo.js";
import type { ErrorDetail } from "./http-errors.js";
import { prisma } from "./prisma.js";

// Live guide tracking (API_CONTRACT_V1.md §11). The guide's app uploads GPS
// fixes in batches while a trek is IN_PROGRESS; coordinators poll the active
// treks with each guide's latest fix and the path walked so far.

// One upload holds at most this many fixes, so an app that queued fixes
// through a dead zone can catch up over a few requests.
export const MAX_BATCH = 50;
// Each trek's path is thinned to about this many points for the live map.
export const MAX_PATH_POINTS = 500;

export type LocationInput = { latitude: number; longitude: number; accuracyM: number | null; recordedAt: Date };
type Refused<Code extends string> = { refusal: Code };

export function parseLocationBatch(body: Record<string, unknown>, now: Date): { points: LocationInput[] } | { details: ErrorDetail[] } {
  const { points } = body;
  if (!Array.isArray(points) || points.length === 0) {
    return { details: [{ field: "points", code: "REQUIRED", message: "Send at least one location." }] };
  }
  if (points.length > MAX_BATCH) {
    return { details: [{ field: "points", code: "TOO_MANY", message: `Send at most ${MAX_BATCH} locations at a time.` }] };
  }

  const details: ErrorDetail[] = [];
  const parsed: LocationInput[] = [];
  points.forEach((raw, index) => {
    const prefix = `points[${index}].`;
    const point = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const pointDetails = [...coordinateDetails(point.latitude, point.longitude, prefix), ...accuracyDetails(point.accuracyM, prefix)];
    const recorded = typeof point.recordedAt === "string" ? new Date(point.recordedAt) : null;
    if (!recorded || Number.isNaN(recorded.valueOf())) {
      pointDetails.push({ field: `${prefix}recordedAt`, code: "INVALID_DATE", message: "Use an ISO 8601 date and time." });
    }
    details.push(...pointDetails);
    if (pointDetails.length) return;
    parsed.push({
      latitude: point.latitude as number,
      longitude: point.longitude as number,
      accuracyM: finite(point.accuracyM) ? point.accuracyM : null,
      // A fix from the future is the phone's clock, not the GPS.
      recordedAt: recorded! < now ? recorded! : now,
    });
  });
  return details.length ? { details } : { points: parsed };
}

// Stores fixes for the guide's own started trek. Fixes taken before the trek
// started are dropped rather than refused, so a queued batch still lands.
export async function recordLocations(
  guideId: string,
  bookingId: string,
  points: LocationInput[],
): Promise<Refused<"BOOKING_NOT_FOUND" | "TREK_NOT_IN_PROGRESS"> | { accepted: number }> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { guideId: true, status: true, trekStartedAt: true } });
  if (!booking || booking.guideId !== guideId) return { refusal: "BOOKING_NOT_FOUND" };
  if (booking.status !== "IN_PROGRESS") return { refusal: "TREK_NOT_IN_PROGRESS" };

  const started = booking.trekStartedAt;
  const kept = started ? points.filter((point) => point.recordedAt >= started) : points;
  if (kept.length) {
    await prisma.guideLocation.createMany({ data: kept.map((point) => ({ ...point, bookingId, guideId })) });
  }
  return { accepted: kept.length };
}

export const liveTrekSelect = {
  id: true,
  trekStartedAt: true,
  trail: { select: { id: true, slug: true, name: true } },
  guide: { select: { id: true, user: { select: { fullName: true } } } },
  _count: { select: { participants: true } },
  locations: {
    orderBy: { recordedAt: "asc" },
    select: { latitude: true, longitude: true, accuracyM: true, recordedAt: true },
  },
} satisfies Prisma.BookingSelect;

type LiveTrekRecord = Prisma.BookingGetPayload<{ select: typeof liveTrekSelect }>;

// Keeps every n-th point so the path has at most [max] points, and always the
// newest one so the line ends at the guide's marker.
export function thinPath<T>(points: T[], max = MAX_PATH_POINTS): T[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / (max - 1));
  const kept = points.filter((_, index) => index % step === 0);
  if (kept[kept.length - 1] !== points[points.length - 1]) kept.push(points[points.length - 1]);
  return kept;
}

export function liveTrekResponse(booking: LiveTrekRecord) {
  const last = booking.locations[booking.locations.length - 1];
  return {
    bookingId: booking.id,
    trail: booking.trail,
    guide: booking.guide ? { id: booking.guide.id, fullName: booking.guide.user.fullName } : null,
    trekStartedAt: booking.trekStartedAt?.toISOString() ?? null,
    participantCount: booking._count.participants,
    latest: last
      ? { latitude: last.latitude, longitude: last.longitude, accuracyM: last.accuracyM, recordedAt: last.recordedAt.toISOString() }
      : null,
    path: thinPath(booking.locations).map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      recordedAt: point.recordedAt.toISOString(),
    })),
  };
}

// Every started trek, longest on the trail first.
export async function liveTreks() {
  const bookings = await prisma.booking.findMany({
    where: { status: "IN_PROGRESS" },
    select: liveTrekSelect,
    orderBy: { trekStartedAt: "asc" },
  });
  return bookings.map(liveTrekResponse);
}
