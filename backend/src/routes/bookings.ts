import { Router, type Response } from "express";
import { fail, type ErrorDetail as Details } from "../lib/http-errors.js";
import { bookingInclude, bookingResponse } from "../lib/booking-representation.js";
import { MAX_PARTICIPANTS, downpaymentFor } from "../lib/package-policy.js";
import { prisma } from "../lib/prisma.js";
import { nonblank, optionalEmail, validAge, validOptionalEmail } from "../lib/validation.js";
import { requireFirebaseAuth, type AuthenticatedRequest } from "../middleware/require-firebase-auth.js";

function validation(response: Response, details: Details[]) {
  return fail(response, 422, "VALIDATION_ERROR", "Review the booking details and try again.", details);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return true;
}

function validateSchedule(body: Record<string, unknown>) {
  const details: Details[] = [];
  if (!validDate(body.scheduledDate)) details.push({ field: "scheduledDate", code: "INVALID_DATE", message: "Use a valid date in YYYY-MM-DD format." });
  if (!validTime(body.scheduledTime)) details.push({ field: "scheduledTime", code: "INVALID_TIME", message: "Use a valid time in HH:mm format." });
  return details;
}

async function currentProfile(request: AuthenticatedRequest) {
  if (!request.authUser) return { error: "UNAUTHORIZED" as const };
  const user = await prisma.user.findUnique({
    where: { firebaseUid: request.authUser.firebaseUid },
    select: { id: true, fullName: true, email: true, role: true },
  });
  return user ?? { error: "PROFILE_NOT_FOUND" as const };
}

export const bookingsRouter = Router();
bookingsRouter.use(requireFirebaseAuth);

bookingsRouter.post("/", async (request, response) => {
  try {
    const profile = await currentProfile(request as AuthenticatedRequest);
    if ("error" in profile) return fail(response, profile.error === "UNAUTHORIZED" ? 401 : 404, profile.error, profile.error === "PROFILE_NOT_FOUND" ? "User profile was not found." : "Authentication is required.");
    if (profile.role !== "HIKER") return fail(response, 403, "FORBIDDEN", "Only hikers can create bookings.");

    const body = request.body && typeof request.body === "object" && !Array.isArray(request.body) ? request.body as Record<string, unknown> : {};
    const details: Details[] = [];
    if (!nonblank(body.trailId)) details.push({ field: "trailId", code: "REQUIRED", message: "Select a trail." });
    details.push(...validateSchedule(body));
    const ownerDetails = body.ownerDetails && typeof body.ownerDetails === "object" && !Array.isArray(body.ownerDetails) ? body.ownerDetails as Record<string, unknown> : {};
    if (!validAge(ownerDetails.age)) details.push({ field: "ownerDetails.age", code: "INVALID_AGE", message: "Age must be a positive integer." });
    if (!nonblank(ownerDetails.address)) details.push({ field: "ownerDetails.address", code: "REQUIRED", message: "Address is required." });
    const additional = body.additionalParticipants === undefined ? [] : body.additionalParticipants;
    if (!Array.isArray(additional)) details.push({ field: "additionalParticipants", code: "INVALID_TYPE", message: "Additional participants must be an array." });
    else {
      if (additional.length > MAX_PARTICIPANTS - 1) details.push({ field: "additionalParticipants", code: "PARTICIPANT_LIMIT_EXCEEDED", message: "A package can include at most five participants, including the booking owner." });
      additional.forEach((item, index) => {
        const person = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
        if (!nonblank(person.name)) details.push({ field: `additionalParticipants.${index}.name`, code: "REQUIRED", message: "Name is required." });
        if (!validAge(person.age)) details.push({ field: `additionalParticipants.${index}.age`, code: "INVALID_AGE", message: "Age must be a positive integer." });
        if (!nonblank(person.address)) details.push({ field: `additionalParticipants.${index}.address`, code: "REQUIRED", message: "Address is required." });
        if (!validOptionalEmail(person.email)) details.push({ field: `additionalParticipants.${index}.email`, code: "INVALID_EMAIL", message: "Enter a valid email address." });
      });
    }
    if (details.length) return validation(response, details);

    const trail = await prisma.trail.findFirst({ where: { id: body.trailId as string, isActive: true }, select: { id: true, packagePrice: true } });
    if (!trail) return validation(response, [{ field: "trailId", code: "UNSUPPORTED_TRAIL", message: "Select a supported trail." }]);

    const booking = await prisma.$transaction(async (tx) => tx.booking.create({
      data: {
        ownerId: profile.id,
        trailId: trail.id,
        scheduledDate: body.scheduledDate as string,
        scheduledTime: body.scheduledTime as string,
        packagePrice: trail.packagePrice,
        downpaymentAmount: downpaymentFor(trail.packagePrice),
        status: "PENDING_CONFIRMATION",
        downpaymentStatus: "PENDING_VERIFICATION",
        participants: { create: [
          { kind: "BOOKING_OWNER", name: profile.fullName, age: ownerDetails.age as number, address: (ownerDetails.address as string).trim(), email: profile.email },
          ...(additional as Record<string, unknown>[]).map((person) => ({
            kind: "ADDITIONAL_PARTICIPANT" as const,
            name: (person.name as string).trim(), age: person.age as number, address: (person.address as string).trim(),
            email: optionalEmail(person.email),
          })),
        ] },
      }, include: bookingInclude,
    }));
    return response.status(201).json(bookingResponse(booking));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Booking creation failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not create booking.");
  }
});

bookingsRouter.get("/", async (request, response) => {
  try {
    const profile = await currentProfile(request as AuthenticatedRequest);
    if ("error" in profile) return fail(response, profile.error === "UNAUTHORIZED" ? 401 : 404, profile.error, profile.error === "PROFILE_NOT_FOUND" ? "User profile was not found." : "Authentication is required.");
    if (profile.role !== "HIKER") return fail(response, 403, "FORBIDDEN", "Only hikers can view these bookings.");
    const bookings = await prisma.booking.findMany({ where: { ownerId: profile.id }, include: bookingInclude, orderBy: { createdAt: "desc" } });
    return response.status(200).json({ items: bookings.map(bookingResponse) });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Booking list failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve bookings.");
  }
});

bookingsRouter.get("/:bookingId", async (request, response) => {
  try {
    const profile = await currentProfile(request as AuthenticatedRequest);
    if ("error" in profile) return fail(response, profile.error === "UNAUTHORIZED" ? 401 : 404, profile.error, profile.error === "PROFILE_NOT_FOUND" ? "User profile was not found." : "Authentication is required.");
    if (profile.role !== "HIKER") return fail(response, 403, "FORBIDDEN", "Only hikers can view bookings.");
    const booking = await prisma.booking.findFirst({ where: { id: request.params.bookingId, ownerId: profile.id }, include: bookingInclude });
    if (!booking) return fail(response, 404, "BOOKING_NOT_FOUND", "Booking was not found.");
    return response.status(200).json(bookingResponse(booking));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Booking lookup failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve booking.");
  }
});

bookingsRouter.post("/:bookingId/reschedule", async (request, response) => {
  try {
    const profile = await currentProfile(request as AuthenticatedRequest);
    if ("error" in profile) return fail(response, profile.error === "UNAUTHORIZED" ? 401 : 404, profile.error, profile.error === "PROFILE_NOT_FOUND" ? "User profile was not found." : "Authentication is required.");
    if (profile.role !== "HIKER") return fail(response, 403, "FORBIDDEN", "Only hikers can reschedule bookings.");
    const body = request.body && typeof request.body === "object" && !Array.isArray(request.body) ? request.body as Record<string, unknown> : {};
    const details = validateSchedule(body);
    if (details.length) return validation(response, details);
    const booking = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: { id: request.params.bookingId, ownerId: profile.id, status: "CONFIRMED" },
        data: { scheduledDate: body.scheduledDate as string, scheduledTime: body.scheduledTime as string, status: "PENDING_CONFIRMATION" },
      });
      if (!updated.count) return null;
      return tx.booking.findFirst({ where: { id: request.params.bookingId, ownerId: profile.id }, include: bookingInclude });
    });
    if (!booking) {
      const owned = await prisma.booking.findFirst({ where: { id: request.params.bookingId, ownerId: profile.id }, select: { id: true } });
      return owned ? fail(response, 409, "RESCHEDULE_NOT_ALLOWED", "Booking cannot be rescheduled in its current state.") : fail(response, 404, "BOOKING_NOT_FOUND", "Booking was not found.");
    }
    return response.status(200).json(bookingResponse(booking));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Booking reschedule failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not reschedule booking.");
  }
});

bookingsRouter.post("/:bookingId/confirm", async (request, response) => {
  try {
    const profile = await currentProfile(request as AuthenticatedRequest);
    if ("error" in profile) return fail(response, profile.error === "UNAUTHORIZED" ? 401 : 404, profile.error, profile.error === "PROFILE_NOT_FOUND" ? "User profile was not found." : "Authentication is required.");
    if (profile.role !== "COORDINATOR") return fail(response, 403, "FORBIDDEN", "Coordinator access is required.");
    const booking = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: { id: request.params.bookingId, status: "PENDING_CONFIRMATION", downpaymentStatus: { in: ["PENDING_VERIFICATION", "VERIFIED"] } },
        data: { status: "CONFIRMED", downpaymentStatus: "VERIFIED" },
      });
      if (!updated.count) return null;
      return tx.booking.findUnique({ where: { id: request.params.bookingId }, include: bookingInclude });
    });
    if (!booking) {
      const existing = await prisma.booking.findUnique({ where: { id: request.params.bookingId }, select: { id: true } });
      return existing ? fail(response, 409, "BOOKING_NOT_CONFIRMABLE", "Booking cannot be confirmed in its current state.") : fail(response, 404, "BOOKING_NOT_FOUND", "Booking was not found.");
    }
    return response.status(200).json(bookingResponse(booking));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Booking confirmation failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not confirm booking.");
  }
});
