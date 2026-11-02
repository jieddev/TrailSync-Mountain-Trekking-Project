import { Router } from "express";

import { buildAnalytics, parseRange, rangeInstants } from "../lib/analytics.js";
import { fail } from "../lib/http-errors.js";
import { prisma } from "../lib/prisma.js";
import { requireFirebaseAuth } from "../middleware/require-firebase-auth.js";
import { requireRole } from "../middleware/require-role.js";

// Read-only tourism and operations analytics for a range of Manila dates
// (API_CONTRACT_V1.md §13).
export const coordinatorAnalyticsRouter = Router();
coordinatorAnalyticsRouter.use(requireFirebaseAuth, requireRole("COORDINATOR"));

coordinatorAnalyticsRouter.get("/", async (request, response) => {
  const range = parseRange(request.query);
  if ("field" in range) {
    return fail(response, 400, "VALIDATION_ERROR", range.message, [{ field: range.field, code: "INVALID", message: range.message }]);
  }
  const scheduled = { scheduledDate: { gte: range.from, lte: range.to } };
  const { start, end } = rangeInstants(range);

  try {
    const [trails, guides, completedTreks, statusGroups, incidents, restrictions] = await Promise.all([
      prisma.trail.findMany({ select: { id: true, name: true, isActive: true }, orderBy: { name: "asc" } }),
      prisma.guide.findMany({
        where: { user: { role: "GUIDE" } },
        select: { id: true, user: { select: { fullName: true } } },
      }),
      prisma.booking.findMany({
        where: { status: "COMPLETED", ...scheduled },
        select: {
          scheduledDate: true,
          packagePrice: true,
          trailId: true,
          guideId: true,
          participants: { select: { kind: true, attendance: true } },
        },
      }),
      prisma.booking.groupBy({ by: ["status"], where: scheduled, _count: { _all: true } }),
      prisma.incident.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: { status: true, createdAt: true, acknowledgedAt: true, resolvedAt: true },
      }),
      prisma.trailRestriction.findMany({
        where: { startDate: { lte: range.to }, endDate: { gte: range.from } },
        select: { trailId: true, startDate: true, endDate: true, liftedAt: true },
      }),
    ]);

    return response.status(200).json(
      buildAnalytics({
        range,
        trails,
        guides: guides.map((guide) => ({ id: guide.id, fullName: guide.user.fullName })),
        completedTreks,
        bookingsByStatus: statusGroups.map((group) => ({ status: group.status, count: group._count._all })),
        incidents,
        restrictions,
      }),
    );
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Coordinator analytics failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve analytics.");
  }
});
