import { Router, type Request, type Response } from "express";
import type { Prisma } from "@prisma/client";

import { bookingInclude, withTrailRestriction, withTrailRestrictions } from "../lib/booking-representation.js";
import { sendTrekCertificates } from "../lib/certificates.js";
import { changeAvailability } from "../lib/guide-availability.js";
import { queuePosition } from "../lib/guide-queue.js";
import { completeOwnTrek, startTrek } from "../lib/guide-treks.js";
import { guideResponse, guideSelect } from "../lib/guide-representation.js";
import { fail } from "../lib/http-errors.js";
import { incidentResponse, latestIncident, parseSos, raiseSos } from "../lib/incidents.js";
import { prisma } from "../lib/prisma.js";
import { asObject } from "../lib/validation.js";
import { requireFirebaseAuth } from "../middleware/require-firebase-auth.js";
import { requireRole, type RoleRequest } from "../middleware/require-role.js";

// The signed-in guide's dispatch row, or a 404 response when it is missing.
async function currentGuide(request: Request, response: Response) {
  const guide = await prisma.guide.findUnique({ where: { userId: (request as RoleRequest).profile!.id }, select: guideSelect });
  if (!guide) fail(response, 404, "GUIDE_NOT_FOUND", "Guide profile was not found.");
  return guide;
}

// Trek start/complete refusals (API_CONTRACT_V1.md §6), keyed by error code.
const refusals = {
  BOOKING_NOT_FOUND: [404, "Booking was not found."],
  TREK_NOT_STARTABLE: [409, "Only a trek that has been assigned to you and not yet started can be started."],
  TREK_NOT_IN_PROGRESS: [409, "Only a trek you have started can be completed."],
  BOOKING_NOT_ON_TREK: [409, "Only a group with an assigned guide can complete a trek."],
  TRAIL_RESTRICTED: [409, "This trail is closed today, so the trek cannot start. Contact the coordinator."],
  SOS_NOT_ALLOWED: [409, "An SOS can only be sent for a trek assigned to you that has not been completed."],
} as const;
type Refusal = keyof typeof refusals;

function refuse(response: Response, code: Refusal) {
  const [status, message] = refusals[code];
  return fail(response, status, code, message);
}

type TrekStep = (tx: Prisma.TransactionClient, guideId: string, bookingId: string) => Promise<Refusal | null>;

// Runs a start/complete step for the signed-in guide and returns the updated
// booking; [afterCommit] runs once the step is committed and answered.
async function changeTrek(request: Request, response: Response, step: TrekStep, afterCommit?: (bookingId: string) => void) {
  const guide = await currentGuide(request, response);
  if (!guide) return;
  const bookingId = String(request.params.bookingId);
  const result = await prisma.$transaction(async (tx): Promise<{ refusal: Refusal } | { booking: unknown }> => {
    const refusal = await step(tx, guide.id, bookingId);
    if (refusal) return { refusal };
    return { booking: await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: bookingInclude }) };
  });
  if ("refusal" in result) return refuse(response, result.refusal);
  response.status(200).json(await withTrailRestriction(prisma, result.booking as any));
  afterCommit?.(bookingId);
  return response;
}

export const guidesRouter = Router();
guidesRouter.use(requireFirebaseAuth, requireRole("GUIDE"));

guidesRouter.get("/me", async (request, response) => {
  try {
    const guide = await currentGuide(request, response);
    if (!guide) return;
    return response.status(200).json(guideResponse(guide, await queuePosition(prisma, guide)));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide profile lookup failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve the guide profile.");
  }
});

guidesRouter.post("/me/availability", async (request, response) => {
  try {
    const guide = await currentGuide(request, response);
    if (!guide) return;
    return await changeAvailability(response, guide.id, request.body);
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide availability change failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not update your availability.");
  }
});

// Bookings dispatched to the signed-in guide: the active trek first, then past ones.
guidesRouter.get("/me/hike-requests", async (request, response) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { guide: { userId: (request as RoleRequest).profile!.id } },
      include: bookingInclude,
      orderBy: [{ status: "asc" }, { scheduledDate: "desc" }, { scheduledTime: "desc" }],
    });
    return response.status(200).json({ items: await withTrailRestrictions(prisma, bookings) });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide hike request list failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve your hike requests.");
  }
});

guidesRouter.post("/me/hike-requests/:bookingId/start", async (request, response) => {
  try {
    return await changeTrek(request, response, startTrek);
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide trek start failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not start the trek.");
  }
});

// Completing sends the guide to the end of the queue, the same rule as the coordinator's completion.
guidesRouter.post("/me/hike-requests/:bookingId/complete", async (request, response) => {
  try {
    // Certificates are emailed after the response, so the guide isn't kept waiting.
    return await changeTrek(request, response, completeOwnTrek, (bookingId) => void sendTrekCertificates(bookingId, request.log));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide trek completion failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not complete the trek.");
  }
});

// SOS (API_CONTRACT_V1.md §10). 201 for a new incident; 200 when the booking
// already has an unresolved one, so retries never raise a second alarm.
guidesRouter.post("/me/hike-requests/:bookingId/sos", async (request, response) => {
  const parsed = parseSos(asObject(request.body), new Date());
  if ("details" in parsed) return fail(response, 422, "VALIDATION_ERROR", "Review the SOS details and try again.", parsed.details);
  try {
    const guide = await currentGuide(request, response);
    if (!guide) return;
    const bookingId = String(request.params.bookingId);
    const result = await raiseSos(guide.id, bookingId, parsed.input);
    if ("refusal" in result) return refuse(response, result.refusal);
    request.log?.warn(
      { requestId: request.id, incidentId: result.incident.id, bookingId, guideId: guide.id, created: result.created, hasLocation: parsed.input.location !== null },
      result.created ? "SOS raised" : "SOS repeated for an unresolved incident",
    );
    return response.status(result.created ? 201 : 200).json(incidentResponse(result.incident));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide SOS failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not send the SOS.");
  }
});

// The newest incident on the guide's booking, so the app can show whether a
// coordinator has acknowledged it.
guidesRouter.get("/me/hike-requests/:bookingId/sos", async (request, response) => {
  try {
    const guide = await currentGuide(request, response);
    if (!guide) return;
    const result = await latestIncident(guide.id, String(request.params.bookingId));
    if ("refusal" in result) return refuse(response, result.refusal);
    return response.status(200).json({ incident: result.incident ? incidentResponse(result.incident) : null });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide SOS lookup failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve the SOS.");
  }
});
