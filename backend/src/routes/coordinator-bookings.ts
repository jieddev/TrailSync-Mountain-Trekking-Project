import { Router } from "express";
import type { BookingStatus } from "@prisma/client";

import { bookingInclude, bookingResponse } from "../lib/booking-representation.js";
import { fail } from "../lib/http-errors.js";
import { prisma } from "../lib/prisma.js";
import { requireFirebaseAuth } from "../middleware/require-firebase-auth.js";
import { requireRole } from "../middleware/require-role.js";

const BOOKING_STATUSES: BookingStatus[] = ["PENDING_CONFIRMATION", "CONFIRMED"];

const coordinatorBookingInclude = { ...bookingInclude, owner: { select: { id: true, fullName: true, email: true } } } as const;

function coordinatorBookingResponse(booking: any) {
  return { ...bookingResponse(booking), owner: { id: booking.owner.id, fullName: booking.owner.fullName, email: booking.owner.email } };
}

export const coordinatorBookingsRouter = Router();
coordinatorBookingsRouter.use(requireFirebaseAuth, requireRole("COORDINATOR"));

coordinatorBookingsRouter.get("/", async (request, response) => {
  const { status } = request.query;
  if (status !== undefined && !BOOKING_STATUSES.includes(status as BookingStatus)) {
    return fail(response, 422, "VALIDATION_ERROR", "Review the booking filters and try again.", [
      { field: "status", code: "INVALID_STATUS", message: "Use PENDING_CONFIRMATION or CONFIRMED." },
    ]);
  }
  try {
    const bookings = await prisma.booking.findMany({
      where: status === undefined ? {} : { status: status as BookingStatus },
      include: coordinatorBookingInclude,
      orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }, { createdAt: "asc" }],
    });
    return response.status(200).json({ items: bookings.map(coordinatorBookingResponse) });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Coordinator booking list failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve bookings.");
  }
});

coordinatorBookingsRouter.get("/:bookingId", async (request, response) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: request.params.bookingId }, include: coordinatorBookingInclude });
    if (!booking) return fail(response, 404, "BOOKING_NOT_FOUND", "Booking was not found.");
    return response.status(200).json(coordinatorBookingResponse(booking));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Coordinator booking lookup failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve booking.");
  }
});
