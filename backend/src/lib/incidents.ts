import type { IncidentStatus, Prisma } from "@prisma/client";

import type { ErrorDetail } from "./http-errors.js";
import { isPrismaUniqueConstraintError } from "./prisma-errors.js";
import { prisma } from "./prisma.js";

// Guide SOS and coordinator incident handling (PROJECT_CONTEXT.md §12). An
// incident goes OPEN → ACKNOWLEDGED → RESOLVED (a coordinator may resolve an
// OPEN one directly). The booking's status is never changed.

export const MAX_NOTE_LENGTH = 500;

// A guide can call for help while their group is dispatched or on the trail.
const SOS_STATUSES = ["GUIDE_ASSIGNED", "IN_PROGRESS"] as const;

export const incidentSelect = {
  id: true,
  status: true,
  latitude: true,
  longitude: true,
  accuracyM: true,
  locationAt: true,
  note: true,
  createdAt: true,
  acknowledgedAt: true,
  acknowledgedBy: { select: { id: true, fullName: true } },
  resolvedAt: true,
  resolvedBy: { select: { id: true, fullName: true } },
  resolutionNote: true,
  guide: { select: { id: true, user: { select: { fullName: true } } } },
  booking: {
    select: {
      id: true,
      status: true,
      scheduledDate: true,
      scheduledTime: true,
      trail: { select: { id: true, name: true } },
      owner: { select: { fullName: true } },
      _count: { select: { participants: true } },
    },
  },
} satisfies Prisma.IncidentSelect;

type IncidentRecord = Prisma.IncidentGetPayload<{ select: typeof incidentSelect }>;
type Refused<Code extends string> = { refusal: Code };

export function incidentResponse(incident: IncidentRecord) {
  const { booking, guide } = incident;
  return {
    id: incident.id,
    status: incident.status,
    booking: {
      id: booking.id,
      status: booking.status,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      trail: booking.trail,
      owner: booking.owner,
      participantCount: booking._count.participants,
    },
    guide: { id: guide.id, fullName: guide.user.fullName },
    location:
      incident.latitude === null || incident.longitude === null
        ? null
        : {
            latitude: incident.latitude,
            longitude: incident.longitude,
            accuracyM: incident.accuracyM,
            recordedAt: incident.locationAt?.toISOString() ?? null,
          },
    note: incident.note,
    createdAt: incident.createdAt.toISOString(),
    acknowledgedAt: incident.acknowledgedAt?.toISOString() ?? null,
    acknowledgedBy: incident.acknowledgedBy,
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    resolvedBy: incident.resolvedBy,
    resolutionNote: incident.resolutionNote,
  };
}

type SosInput = {
  location: { latitude: number; longitude: number; accuracyM: number | null; recordedAt: Date } | null;
  note: string | null;
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

// Everything is optional so an SOS can go out with no GPS fix and no typing.
// A location needs both coordinates; accuracy and its time are extras.
export function parseSos(body: Record<string, unknown>, now: Date): { input: SosInput } | { details: ErrorDetail[] } {
  const details: ErrorDetail[] = [];
  const { latitude, longitude, accuracyM, recordedAt, note } = body;
  const hasLocation = (latitude !== undefined && latitude !== null) || (longitude !== undefined && longitude !== null);
  if (hasLocation) {
    if (!finite(latitude) || latitude < -90 || latitude > 90) details.push({ field: "latitude", code: "INVALID_LOCATION", message: "Latitude must be between -90 and 90." });
    if (!finite(longitude) || longitude < -180 || longitude > 180) details.push({ field: "longitude", code: "INVALID_LOCATION", message: "Longitude must be between -180 and 180." });
  }
  if (accuracyM !== undefined && accuracyM !== null && (!finite(accuracyM) || accuracyM < 0)) {
    details.push({ field: "accuracyM", code: "INVALID_LOCATION", message: "Accuracy must be zero or more metres." });
  }
  const recorded = typeof recordedAt === "string" ? new Date(recordedAt) : null;
  if (recordedAt !== undefined && recordedAt !== null && (!recorded || Number.isNaN(recorded.valueOf()))) {
    details.push({ field: "recordedAt", code: "INVALID_DATE", message: "Use an ISO 8601 date and time." });
  }
  if (note !== undefined && note !== null && typeof note !== "string") details.push({ field: "note", code: "INVALID_NOTE", message: "The note must be text." });
  else if (typeof note === "string" && note.trim().length > MAX_NOTE_LENGTH) details.push({ field: "note", code: "TOO_LONG", message: `Use at most ${MAX_NOTE_LENGTH} characters.` });
  if (details.length) return { details };

  return {
    input: {
      location: hasLocation
        ? {
            latitude: latitude as number,
            longitude: longitude as number,
            accuracyM: finite(accuracyM) ? accuracyM : null,
            // A fix from the future is the phone's clock, not the GPS.
            recordedAt: recorded && recorded < now ? recorded : now,
          }
        : null,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
    },
  };
}

const locationData = (location: SosInput["location"]) =>
  location
    ? { latitude: location.latitude, longitude: location.longitude, accuracyM: location.accuracyM, locationAt: location.recordedAt }
    : {};

const unresolved = (bookingId: string) => ({ bookingId, status: { not: "RESOLVED" as const } });

// Raises an SOS for the guide's own dispatched or started trek. A repeated SOS
// returns the unresolved incident instead of a new one, with the newer
// location if one came with it, so retries on a bad connection are safe.
export async function raiseSos(
  guideId: string,
  bookingId: string,
  input: SosInput,
): Promise<Refused<"BOOKING_NOT_FOUND" | "SOS_NOT_ALLOWED"> | { incident: IncidentRecord; created: boolean }> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { guideId: true, status: true } });
  if (!booking || booking.guideId !== guideId) return { refusal: "BOOKING_NOT_FOUND" };
  if (!(SOS_STATUSES as readonly string[]).includes(booking.status)) return { refusal: "SOS_NOT_ALLOWED" };

  const existing = await prisma.incident.findFirst({ where: unresolved(bookingId), select: { id: true, locationAt: true } });
  if (existing) return { incident: await updateLocation(existing, input), created: false };
  try {
    const incident = await prisma.incident.create({
      data: { bookingId, guideId, note: input.note, ...locationData(input.location) },
      select: incidentSelect,
    });
    return { incident, created: true };
  } catch (error) {
    // Two SOS requests raced; the partial unique index kept only the first.
    if (!isPrismaUniqueConstraintError(error)) throw error;
    const winner = await prisma.incident.findFirst({ where: unresolved(bookingId), select: { id: true, locationAt: true } });
    if (!winner) throw error;
    return { incident: await updateLocation(winner, input), created: false };
  }
}

async function updateLocation(existing: { id: string; locationAt: Date | null }, input: SosInput) {
  const newer = input.location && (!existing.locationAt || input.location.recordedAt > existing.locationAt);
  if (!newer) return prisma.incident.findUniqueOrThrow({ where: { id: existing.id }, select: incidentSelect });
  return prisma.incident.update({ where: { id: existing.id }, data: locationData(input.location), select: incidentSelect });
}

// The newest incident on the guide's own booking, so the app can show whether
// a coordinator has seen the SOS. Null when there has never been one.
export async function latestIncident(
  guideId: string,
  bookingId: string,
): Promise<Refused<"BOOKING_NOT_FOUND"> | { incident: IncidentRecord | null }> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { guideId: true } });
  if (!booking || booking.guideId !== guideId) return { refusal: "BOOKING_NOT_FOUND" };
  const incident = await prisma.incident.findFirst({ where: { bookingId }, orderBy: { createdAt: "desc" }, select: incidentSelect });
  return { incident };
}

type Transition = { from: IncidentStatus[]; data: (coordinatorId: string, now: Date, note?: string) => Prisma.IncidentUpdateManyMutationInput };

export const transitions = {
  acknowledge: {
    from: ["OPEN"],
    data: (coordinatorId, now) => ({ status: "ACKNOWLEDGED", acknowledgedAt: now, acknowledgedById: coordinatorId }),
  },
  resolve: {
    from: ["OPEN", "ACKNOWLEDGED"],
    data: (coordinatorId, now, note) => ({ status: "RESOLVED", resolvedAt: now, resolvedById: coordinatorId, resolutionNote: note }),
  },
} satisfies Record<string, Transition>;

// Moves an incident on with a guarded update, so two coordinators acting at
// once cannot both succeed.
export async function changeIncident(
  incidentId: string,
  transition: Transition,
  coordinatorId: string,
  note?: string,
  now = new Date(),
): Promise<Refused<"INCIDENT_NOT_FOUND" | "INCIDENT_ALREADY_ACKNOWLEDGED" | "INCIDENT_ALREADY_RESOLVED"> | { incident: IncidentRecord }> {
  const changed = await prisma.incident.updateMany({
    where: { id: incidentId, status: { in: transition.from } },
    data: transition.data(coordinatorId, now, note),
  });
  const incident = await prisma.incident.findUnique({ where: { id: incidentId }, select: incidentSelect });
  if (!incident) return { refusal: "INCIDENT_NOT_FOUND" };
  if (!changed.count) return { refusal: incident.status === "RESOLVED" ? "INCIDENT_ALREADY_RESOLVED" : "INCIDENT_ALREADY_ACKNOWLEDGED" };
  return { incident };
}
