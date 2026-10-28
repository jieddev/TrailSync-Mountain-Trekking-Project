import { Router, type Response } from "express";

import { fail, type ErrorDetail } from "../lib/http-errors.js";
import { manilaToday } from "../lib/manila-date.js";
import { prisma } from "../lib/prisma.js";
import { restrictionResponse, restrictionSelect } from "../lib/trail-restrictions.js";
import { asObject, nonblank } from "../lib/validation.js";
import { requireFirebaseAuth } from "../middleware/require-firebase-auth.js";
import { requireRole, type RoleRequest } from "../middleware/require-role.js";

const MAX_REASON_LENGTH = 500;

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

// Shape and date checks; the trail is checked against the catalog afterwards.
function restrictionErrors(body: Record<string, unknown>, today: string) {
  const details: ErrorDetail[] = [];
  if (!nonblank(body.trailId)) details.push({ field: "trailId", code: "REQUIRED", message: "Select a trail." });
  if (!validDate(body.startDate)) details.push({ field: "startDate", code: "INVALID_DATE", message: "Use a valid date in YYYY-MM-DD format." });
  if (!validDate(body.endDate)) details.push({ field: "endDate", code: "INVALID_DATE", message: "Use a valid date in YYYY-MM-DD format." });
  else if (validDate(body.startDate) && body.endDate < body.startDate) details.push({ field: "endDate", code: "END_BEFORE_START", message: "The last day cannot be before the first day." });
  else if (body.endDate < today) details.push({ field: "endDate", code: "DATE_IN_PAST", message: "The last day cannot be in the past." });
  if (!nonblank(body.reason)) details.push({ field: "reason", code: "REQUIRED", message: "Give a reason. Hikers and guides will see it." });
  else if (body.reason.trim().length > MAX_REASON_LENGTH) details.push({ field: "reason", code: "TOO_LONG", message: `Use at most ${MAX_REASON_LENGTH} characters.` });
  return details;
}

function validation(response: Response, details: ErrorDetail[]) {
  return fail(response, 422, "VALIDATION_ERROR", "Review the restriction details and try again.", details);
}

export const coordinatorTrailRestrictionsRouter = Router();
coordinatorTrailRestrictionsRouter.use(requireFirebaseAuth, requireRole("COORDINATOR"));

// Newest first, including lifted and ended ones as a record.
coordinatorTrailRestrictionsRouter.get("/", async (request, response) => {
  try {
    const restrictions = await prisma.trailRestriction.findMany({
      select: restrictionSelect,
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });
    const today = manilaToday();
    return response.status(200).json({ items: restrictions.map((restriction) => restrictionResponse(restriction, today)) });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Coordinator trail restriction list failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve trail restrictions.");
  }
});

// Closing a trail does not change existing bookings: they show the restriction
// and the server refuses check-in, dispatch and trek start while it applies.
coordinatorTrailRestrictionsRouter.post("/", async (request, response) => {
  const body = asObject(request.body);
  const today = manilaToday();
  const details = restrictionErrors(body, today);
  if (details.length) return validation(response, details);
  try {
    const trail = await prisma.trail.findFirst({ where: { id: body.trailId as string, isActive: true }, select: { id: true } });
    if (!trail) return validation(response, [{ field: "trailId", code: "UNSUPPORTED_TRAIL", message: "Select a supported trail." }]);
    const restriction = await prisma.trailRestriction.create({
      data: {
        trailId: trail.id,
        startDate: body.startDate as string,
        endDate: body.endDate as string,
        reason: (body.reason as string).trim(),
        createdById: (request as RoleRequest).profile!.id,
      },
      select: restrictionSelect,
    });
    request.log?.info({ requestId: request.id, restrictionId: restriction.id, trailId: trail.id }, "Trail restricted");
    return response.status(201).json(restrictionResponse(restriction, today));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Trail restriction creation failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not restrict the trail.");
  }
});

coordinatorTrailRestrictionsRouter.post("/:restrictionId/lift", async (request, response) => {
  const { restrictionId } = request.params;
  try {
    const lifted = await prisma.trailRestriction.updateMany({
      where: { id: restrictionId, liftedAt: null },
      data: { liftedAt: new Date(), liftedById: (request as RoleRequest).profile!.id },
    });
    const restriction = await prisma.trailRestriction.findUnique({ where: { id: restrictionId }, select: restrictionSelect });
    if (!restriction) return fail(response, 404, "RESTRICTION_NOT_FOUND", "Trail restriction was not found.");
    if (!lifted.count) return fail(response, 409, "RESTRICTION_ALREADY_LIFTED", "This restriction has already been lifted.");
    request.log?.info({ requestId: request.id, restrictionId }, "Trail restriction lifted");
    return response.status(200).json(restrictionResponse(restriction, manilaToday()));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Trail restriction lift failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not lift the restriction.");
  }
});
