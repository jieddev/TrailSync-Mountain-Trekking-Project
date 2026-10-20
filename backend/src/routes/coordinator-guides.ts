import { Router } from "express";

import { changeAvailability } from "../lib/guide-availability.js";
import { guideResponse, guideSelect } from "../lib/guide-representation.js";
import { fail } from "../lib/http-errors.js";
import { prisma } from "../lib/prisma.js";
import { requireFirebaseAuth } from "../middleware/require-firebase-auth.js";
import { requireRole } from "../middleware/require-role.js";

const byName = (a: any, b: any) => a.user.fullName.localeCompare(b.user.fullName);

export const coordinatorGuidesRouter = Router();
coordinatorGuidesRouter.use(requireFirebaseAuth, requireRole("COORDINATOR"));

// The FIFO queue first (front of the queue first), then guides on a trek, then
// guides who are off duty.
coordinatorGuidesRouter.get("/", async (request, response) => {
  try {
    const guides = await prisma.guide.findMany({ where: { user: { role: "GUIDE" } }, select: guideSelect, orderBy: [{ availableSince: "asc" }, { id: "asc" }] });
    const queue = guides.filter((guide) => guide.dutyStatus === "AVAILABLE");
    const assigned = guides.filter((guide) => guide.dutyStatus === "ASSIGNED").sort(byName);
    const offDuty = guides.filter((guide) => guide.dutyStatus === "OFF_DUTY").sort(byName);
    return response.status(200).json({
      items: [
        ...queue.map((guide, index) => guideResponse(guide, index + 1)),
        ...[...assigned, ...offDuty].map((guide) => guideResponse(guide, null)),
      ],
    });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide list failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve guides.");
  }
});

// Lets the coordinator report a guide in, or mark them off duty (for example when
// the guide at the front of the queue is not at the office).
coordinatorGuidesRouter.post("/:guideId/availability", async (request, response) => {
  try {
    return await changeAvailability(response, request.params.guideId, request.body);
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide availability change failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not update the guide's availability.");
  }
});
