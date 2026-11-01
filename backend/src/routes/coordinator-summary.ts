import { Router } from "express";

import { fail } from "../lib/http-errors.js";
import { manilaToday } from "../lib/manila-date.js";
import { prisma } from "../lib/prisma.js";
import { requireFirebaseAuth } from "../middleware/require-firebase-auth.js";
import { requireRole } from "../middleware/require-role.js";

// Counts for the coordinator dashboard and navigation badges, grouped by what
// the coordinator does next rather than by raw booking status.
export const coordinatorSummaryRouter = Router();
coordinatorSummaryRouter.use(requireFirebaseAuth, requireRole("COORDINATOR"));

coordinatorSummaryRouter.get("/", async (request, response) => {
  const today = manilaToday();
  try {
    const [bookingGroups, arrivingToday, guideGroups, nextUp, pendingApplications, openIncidents, activeRestrictions] = await Promise.all([
      prisma.booking.groupBy({ by: ["status", "downpaymentStatus"], _count: { _all: true } }),
      prisma.booking.count({ where: { status: "CONFIRMED", scheduledDate: today } }),
      prisma.guide.groupBy({ by: ["dutyStatus"], where: { user: { role: "GUIDE" } }, _count: { _all: true } }),
      prisma.guide.findFirst({
        where: { dutyStatus: "AVAILABLE", user: { role: "GUIDE" } },
        select: { id: true, user: { select: { fullName: true } } },
        orderBy: [{ availableSince: "asc" }, { id: "asc" }],
      }),
      prisma.guideApplication.count({ where: { status: "PENDING" } }),
      prisma.incident.count({ where: { status: "OPEN" } }),
      prisma.trailRestriction.count({ where: { liftedAt: null, startDate: { lte: today }, endDate: { gte: today } } }),
    ]);

    const bookings = (match: (group: (typeof bookingGroups)[number]) => boolean) =>
      bookingGroups.filter(match).reduce((total, group) => total + group._count._all, 0);
    const guides = (dutyStatus: string) =>
      guideGroups.find((group) => group.dutyStatus === dutyStatus)?._count._all ?? 0;
    const pending = (group: (typeof bookingGroups)[number]) => group.status === "PENDING_CONFIRMATION";

    return response.status(200).json({
      bookings: {
        // A rescheduled booking keeps its verified payment but still needs confirming.
        needsReview: bookings((group) => pending(group) && group.downpaymentStatus !== "REJECTED"),
        waitingOnHiker: bookings((group) => pending(group) && group.downpaymentStatus === "REJECTED"),
        upcoming: bookings((group) => group.status === "CONFIRMED"),
        arrivingToday,
        completed: bookings((group) => group.status === "COMPLETED"),
      },
      dispatch: {
        waitingForGuide: bookings((group) => group.status === "CHECKED_IN"),
        onTrail: bookings((group) => group.status === "GUIDE_ASSIGNED" || group.status === "IN_PROGRESS"),
      },
      guides: {
        available: guides("AVAILABLE"),
        onTrek: guides("ASSIGNED"),
        nextUp: nextUp ? { id: nextUp.id, fullName: nextUp.user.fullName } : null,
      },
      guideApplications: { pending: pendingApplications },
      incidents: { open: openIncidents },
      trailRestrictions: { active: activeRestrictions },
    });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Coordinator summary failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve the coordinator summary.");
  }
});
