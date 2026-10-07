import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireFirebaseAuth, type AuthenticatedRequest } from "../middleware/require-firebase-auth.js";

const TRAIL = "Lake Janagdan";
const PACKAGE_PRICE = 800;
const MAX_PARTICIPANTS = 5;
const DOWNPAYMENT = PACKAGE_PRICE * 0.5;

type BookingRequest = Request & { id?: string };
type Details = { field: string; code: string; message: string };

function fail(response: Response, status: number, code: string, message: string, details?: Details[]) {
  const request = response.req as BookingRequest;
  return response.status(status).json({
    error: { code, message, ...(details?.length ? { details } : {}) },
    requestId: request.id,
  });
}

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

function validAge(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value > 0;
}

function nonblank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateSchedule(body: Record<string, unknown>) {
  const details: Details[] = [];
  if (!validDate(body.scheduledDate)) details.push({ field: "scheduledDate", code: "INVALID_DATE", message: "Use a valid date in YYYY-MM-DD format." });
  if (!validTime(body.scheduledTime)) details.push({ field: "scheduledTime", code: "INVALID_TIME", message: "Use a valid time in HH:mm format." });
  return details;
}

function bookingResponse(booking: any) {
  const participants = booking.participants.map((participant: any) => ({
    id: participant.id,
    kind: participant.kind,
    name: participant.name,
    age: participant.age,
    address: participant.address,
  }));
  return {
    id: booking.id,
    trail: booking.trail,
    scheduledDate: booking.scheduledDate,
    scheduledTime: booking.scheduledTime,
    status: booking.status,
    downpaymentStatus: booking.downpaymentStatus,
    participants,
    participantCount: participants.length,
    package: { price: { amount: booking.packagePrice, currency: "PHP" }, maximumParticipants: MAX_PARTICIPANTS, guideCount: 1 },
    paymentRequirement: { downpaymentPercent: 50, amount: DOWNPAYMENT, currency: "PHP" },
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

async function currentProfile(request: AuthenticatedRequest) {
  if (!request.authUser) return { error: "UNAUTHORIZED" as const };
  const user = await prisma.user.findUnique({
    where: { firebaseUid: request.authUser.firebaseUid },
    select: { id: true, fullName: true, role: true },
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
    const details = validateSchedule(body);
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
      });
    }
    if (details.length) return validation(response, details);

    const booking = await prisma.$transaction(async (tx) => tx.booking.create({
      data: {
        ownerId: profile.id,
        trail: TRAIL,
        scheduledDate: body.scheduledDate as string,
        scheduledTime: body.scheduledTime as string,
        packagePrice: PACKAGE_PRICE,
        status: "PENDING_CONFIRMATION",
        downpaymentStatus: "PENDING_VERIFICATION",
        participants: { create: [
          { kind: "BOOKING_OWNER", name: profile.fullName, age: ownerDetails.age as number, address: (ownerDetails.address as string).trim() },
          ...(additional as Record<string, unknown>[]).map((person) => ({
            kind: "ADDITIONAL_PARTICIPANT" as const,
            name: (person.name as string).trim(), age: person.age as number, address: (person.address as string).trim(),
          })),
        ] },
      }, include: { participants: true },
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
    const bookings = await prisma.booking.findMany({ where: { ownerId: profile.id }, include: { participants: true }, orderBy: { createdAt: "desc" } });
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
    const booking = await prisma.booking.findFirst({ where: { id: request.params.bookingId, ownerId: profile.id }, include: { participants: true } });
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
      return tx.booking.findFirst({ where: { id: request.params.bookingId, ownerId: profile.id }, include: { participants: true } });
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
      return tx.booking.findUnique({ where: { id: request.params.bookingId }, include: { participants: true } });
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
