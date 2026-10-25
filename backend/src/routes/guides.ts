import { Router, type Request, type Response } from "express";

import { bookingInclude, bookingResponse } from "../lib/booking-representation.js";
import { changeAvailability } from "../lib/guide-availability.js";
import { completeTrek, queuePosition } from "../lib/guide-queue.js";
import { guideResponse, guideSelect } from "../lib/guide-representation.js";
import { fail } from "../lib/http-errors.js";
import { prisma } from "../lib/prisma.js";
import { requireFirebaseAuth } from "../middleware/require-firebase-auth.js";
import { requireRole, type RoleRequest } from "../middleware/require-role.js";

// The signed-in guide's dispatch row, or a 404 response when it is missing.
async function currentGuide(request: Request, response: Response) {
  const guide = await prisma.guide.findUnique({ where: { userId: (request as RoleRequest).profile!.id }, select: guideSelect });
  if (!guide) fail(response, 404, "GUIDE_NOT_FOUND", "Guide profile was not found.");
  return guide;
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
    return response.status(200).json({ items: bookings.map(bookingResponse) });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide hike request list failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve your hike requests.");
  }
});

// The guide ends their own trek (same rule as the coordinator's complete); they
// rejoin the end of the queue. Another guide's booking reads as not found.
guidesRouter.post("/me/hike-requests/:bookingId/complete", async (request, response) => {
  const { bookingId } = request.params;
  try {
    const guide = await currentGuide(request, response);
    if (!guide) return;
    const result = await prisma.$transaction(async (tx) => {
      const own = await tx.booking.findFirst({ where: { id: bookingId, guideId: guide.id }, select: { id: true } });
      const refusal = own ? await completeTrek(tx, bookingId) : ("BOOKING_NOT_FOUND" as const);
      if (refusal) return { refusal };
      return { booking: await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: bookingInclude }) };
    });
    if (result.refusal === "BOOKING_NOT_FOUND") return fail(response, 404, "BOOKING_NOT_FOUND", "Booking was not found.");
    if (result.refusal === "BOOKING_NOT_ON_TREK") {
      return fail(response, 409, "BOOKING_NOT_ON_TREK", "Only a group with an assigned guide can complete a trek.");
    }
    return response.status(200).json(bookingResponse(result.booking));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide trek completion failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not complete the trek.");
  }
});
