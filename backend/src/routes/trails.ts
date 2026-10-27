import { Router } from "express";
import { fail } from "../lib/http-errors.js";
import { manilaToday } from "../lib/manila-date.js";
import { CURRENCY, DOWNPAYMENT_PERCENT, GUIDE_COUNT, MAX_PARTICIPANTS, downpaymentFor } from "../lib/package-policy.js";
import { prisma } from "../lib/prisma.js";
import { publicRestrictionResponse } from "../lib/trail-restrictions.js";

type TrailRecord = { id: string; slug: string; name: string; description: string | null; packagePrice: number };

const trailSelect = { id: true, slug: true, name: true, description: true, packagePrice: true } as const;

function trailResponse(trail: TrailRecord) {
  return {
    id: trail.id,
    slug: trail.slug,
    name: trail.name,
    description: trail.description,
    package: { price: { amount: trail.packagePrice, currency: CURRENCY }, maximumParticipants: MAX_PARTICIPANTS, guideCount: GUIDE_COUNT },
    paymentRequirement: { downpaymentPercent: DOWNPAYMENT_PERCENT, amount: downpaymentFor(trail.packagePrice), currency: CURRENCY },
  };
}

export const trailsRouter = Router();

trailsRouter.get("/", async (request, response) => {
  try {
    const trails = await prisma.trail.findMany({ where: { isActive: true }, select: trailSelect, orderBy: { name: "asc" } });
    return response.status(200).json({ items: trails.map(trailResponse) });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Trail list failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve trails.");
  }
});

trailsRouter.get("/:trailId", async (request, response) => {
  try {
    const trail = await prisma.trail.findFirst({ where: { id: request.params.trailId, isActive: true }, select: trailSelect });
    if (!trail) return fail(response, 404, "TRAIL_NOT_FOUND", "Trail was not found.");
    return response.status(200).json(trailResponse(trail));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Trail lookup failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve trail.");
  }
});

// Closures that apply today or later, soonest first, so hikers can avoid them.
trailsRouter.get("/:trailId/restrictions", async (request, response) => {
  const today = manilaToday();
  try {
    const trail = await prisma.trail.findFirst({ where: { id: request.params.trailId, isActive: true }, select: { id: true } });
    if (!trail) return fail(response, 404, "TRAIL_NOT_FOUND", "Trail was not found.");
    const restrictions = await prisma.trailRestriction.findMany({
      where: { trailId: trail.id, liftedAt: null, endDate: { gte: today } },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    });
    return response.status(200).json({ items: restrictions.map((restriction) => publicRestrictionResponse(restriction, today)) });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Trail restriction list failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve trail restrictions.");
  }
});
