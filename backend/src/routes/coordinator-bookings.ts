import { Router, type Response } from "express";
import type { BookingStatus, Prisma } from "@prisma/client";

import { bookingInclude, bookingResponse } from "../lib/booking-representation.js";
import { completeTrek, dispatchFrontGuide, lockGuideQueue } from "../lib/guide-queue.js";
import { fail, type ErrorDetail } from "../lib/http-errors.js";
import { manilaToday } from "../lib/manila-date.js";
import { MAX_PARTICIPANTS } from "../lib/package-policy.js";
import { prisma } from "../lib/prisma.js";
import { asObject, nonblank, validAge } from "../lib/validation.js";
import { requireFirebaseAuth } from "../middleware/require-firebase-auth.js";
import { requireRole } from "../middleware/require-role.js";

const BOOKING_STATUSES: BookingStatus[] = ["PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "GUIDE_ASSIGNED", "COMPLETED"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const coordinatorBookingInclude = { ...bookingInclude, owner: { select: { id: true, fullName: true, email: true } } } satisfies Prisma.BookingInclude;

function coordinatorBookingResponse(booking: any) {
  return { ...bookingResponse(booking), owner: { id: booking.owner.id, fullName: booking.owner.fullName, email: booking.owner.email } };
}

// Check-in and dispatch refusals (CHECK_IN_AND_DISPATCH_RULES.md), keyed by error code.
const refusals = {
  BOOKING_NOT_FOUND: [404, "Booking was not found."],
  CHECK_IN_NOT_ALLOWED: [409, "Only confirmed bookings can be checked in."],
  NOT_SCHEDULED_TODAY: [409, "This booking is not scheduled for today. The group must reschedule before checking in."],
  BOOKING_NOT_WAITING: [409, "This group is not waiting for a guide."],
  NO_GUIDE_AVAILABLE: [409, "No guide is available yet. Assign one when a guide reports in."],
  BOOKING_NOT_ON_TREK: [409, "Only a group with an assigned guide can complete a trek."],
} as const;
type Refusal = keyof typeof refusals;

function refuse(response: Response, code: Refusal) {
  const [status, message] = refusals[code];
  return fail(response, status, code, message);
}

function checkInValidation(response: Response, details: ErrorDetail[]) {
  return fail(response, 422, "VALIDATION_ERROR", "Review the check-in details and try again.", details);
}

type AttendanceMark = { participantId: string; present: boolean };
type WalkIn = { name: string; age: number; address: string };

// Shape checks that need no database access.
function parseCheckIn(body: Record<string, unknown>) {
  const details: ErrorDetail[] = [];
  const { attendance } = body;
  const walkIns = body.walkIns === undefined ? [] : body.walkIns;
  if (!Array.isArray(attendance) || attendance.length === 0) {
    details.push({ field: "attendance", code: "REQUIRED", message: "Mark each booked participant present or absent." });
  } else {
    attendance.forEach((item, index) => {
      const mark = asObject(item);
      if (!nonblank(mark.participantId)) details.push({ field: `attendance.${index}.participantId`, code: "REQUIRED", message: "Participant is required." });
      if (typeof mark.present !== "boolean") details.push({ field: `attendance.${index}.present`, code: "INVALID_TYPE", message: "Mark the participant present or absent." });
    });
  }
  if (!Array.isArray(walkIns)) {
    details.push({ field: "walkIns", code: "INVALID_TYPE", message: "Walk-ins must be an array." });
  } else {
    walkIns.forEach((item, index) => {
      const person = asObject(item);
      if (!nonblank(person.name)) details.push({ field: `walkIns.${index}.name`, code: "REQUIRED", message: "Name is required." });
      if (!validAge(person.age)) details.push({ field: `walkIns.${index}.age`, code: "INVALID_AGE", message: "Age must be a positive integer." });
      if (!nonblank(person.address)) details.push({ field: `walkIns.${index}.address`, code: "REQUIRED", message: "Address is required." });
    });
  }
  if (details.length) return { details };
  return {
    marks: (attendance as Record<string, unknown>[]).map((mark) => ({ participantId: mark.participantId as string, present: mark.present as boolean })),
    walkIns: (walkIns as Record<string, unknown>[]).map((person) => ({
      name: (person.name as string).trim(), age: person.age as number, address: (person.address as string).trim(),
    })),
  };
}

// Every booked participant is marked exactly once, at least one is present, and
// present + walk-ins fit in one package. Extra people beyond that are handled
// outside TrailSync for now.
function rosterErrors(bookedIds: string[], marks: AttendanceMark[], walkIns: WalkIn[]) {
  const details: ErrorDetail[] = [];
  const booked = new Set(bookedIds);
  const seen = new Set<string>();
  marks.forEach((mark, index) => {
    const field = `attendance.${index}.participantId`;
    if (!booked.has(mark.participantId)) details.push({ field, code: "UNKNOWN_PARTICIPANT", message: "This person is not on the booking." });
    else if (seen.has(mark.participantId)) details.push({ field, code: "DUPLICATE_PARTICIPANT", message: "Each participant can be marked only once." });
    seen.add(mark.participantId);
  });
  if (bookedIds.some((id) => !seen.has(id))) {
    details.push({ field: "attendance", code: "MISSING_PARTICIPANT", message: "Mark every booked participant present or absent." });
  }
  const present = marks.filter((mark) => mark.present && booked.has(mark.participantId)).length;
  if (present === 0) details.push({ field: "attendance", code: "AT_LEAST_ONE_PRESENT", message: "At least one booked participant must be present." });
  if (present + walkIns.length > MAX_PARTICIPANTS) {
    details.push({ field: "walkIns", code: "PARTICIPANT_LIMIT_EXCEEDED", message: `At most ${MAX_PARTICIPANTS} people can be checked in on one package.` });
  }
  return details;
}

export const coordinatorBookingsRouter = Router();
coordinatorBookingsRouter.use(requireFirebaseAuth, requireRole("COORDINATOR"));

coordinatorBookingsRouter.get("/", async (request, response) => {
  const { status, scheduledDate, today } = request.query;
  const details: ErrorDetail[] = [];
  if (status !== undefined && !BOOKING_STATUSES.includes(status as BookingStatus)) {
    details.push({ field: "status", code: "INVALID_STATUS", message: `Use one of ${BOOKING_STATUSES.join(", ")}.` });
  }
  if (scheduledDate !== undefined && (typeof scheduledDate !== "string" || !DATE_PATTERN.test(scheduledDate))) {
    details.push({ field: "scheduledDate", code: "INVALID_DATE", message: "Use a date in YYYY-MM-DD format." });
  }
  if (today !== undefined && today !== "true") details.push({ field: "today", code: "INVALID_VALUE", message: "Use today=true." });
  if (today !== undefined && scheduledDate !== undefined) details.push({ field: "today", code: "CONFLICTING_FILTERS", message: "Use either today or scheduledDate." });
  if (details.length) return fail(response, 422, "VALIDATION_ERROR", "Review the booking filters and try again.", details);

  const where: Prisma.BookingWhereInput = {};
  if (status !== undefined) where.status = status as BookingStatus;
  if (scheduledDate !== undefined) where.scheduledDate = scheduledDate as string;
  if (today === "true") where.scheduledDate = manilaToday();
  try {
    const bookings = await prisma.booking.findMany({
      where,
      include: coordinatorBookingInclude,
      orderBy: status === "CHECKED_IN"
        ? [{ checkedInAt: "asc" }]
        : [{ scheduledDate: "asc" }, { scheduledTime: "asc" }, { createdAt: "asc" }],
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

// Physical check-in on the scheduled day. In the same transaction, the guide at
// the front of the queue is assigned; with no guide available the booking waits
// in CHECKED_IN until a coordinator assigns one.
coordinatorBookingsRouter.post("/:bookingId/check-in", async (request, response) => {
  const { bookingId } = request.params;
  const parsed = parseCheckIn(asObject(request.body));
  if ("details" in parsed) return checkInValidation(response, parsed.details!);
  const today = manilaToday();
  try {
    const result = await prisma.$transaction(async (tx): Promise<{ refusal: Refusal } | { details: ErrorDetail[] } | { booking: unknown }> => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { status: true, scheduledDate: true, participants: { select: { id: true } } } });
      if (!booking) return { refusal: "BOOKING_NOT_FOUND" };
      if (booking.status !== "CONFIRMED") return { refusal: "CHECK_IN_NOT_ALLOWED" };
      if (booking.scheduledDate !== today) return { refusal: "NOT_SCHEDULED_TODAY" };
      const details = rosterErrors(booking.participants.map((participant) => participant.id), parsed.marks, parsed.walkIns);
      if (details.length) return { details };

      const now = new Date();
      const checkedIn = await tx.booking.updateMany({
        where: { id: bookingId, status: "CONFIRMED", scheduledDate: today },
        data: { status: "CHECKED_IN", checkedInAt: now },
      });
      if (!checkedIn.count) return { refusal: "CHECK_IN_NOT_ALLOWED" };
      for (const [present, attendance] of [[true, "PRESENT"], [false, "ABSENT"]] as const) {
        const ids = parsed.marks.filter((mark) => mark.present === present).map((mark) => mark.participantId);
        if (ids.length) await tx.bookingParticipant.updateMany({ where: { bookingId, id: { in: ids } }, data: { attendance } });
      }
      if (parsed.walkIns.length) {
        await tx.bookingParticipant.createMany({
          data: parsed.walkIns.map((person) => ({ bookingId, kind: "WALK_IN" as const, attendance: "PRESENT" as const, ...person })),
        });
      }
      await dispatchFrontGuide(tx, bookingId, now);
      return { booking: await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: coordinatorBookingInclude }) };
    });
    if ("refusal" in result) return refuse(response, result.refusal);
    if ("details" in result) return checkInValidation(response, result.details);
    return response.status(200).json(coordinatorBookingResponse(result.booking));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Booking check-in failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not check in the booking.");
  }
});

// Assigns the guide at the front of the queue to a group waiting in CHECKED_IN.
coordinatorBookingsRouter.post("/:bookingId/assign-guide", async (request, response) => {
  const { bookingId } = request.params;
  try {
    const result = await prisma.$transaction(async (tx): Promise<{ refusal: Refusal } | { booking: unknown }> => {
      await lockGuideQueue(tx);
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
      if (!booking) return { refusal: "BOOKING_NOT_FOUND" };
      if (booking.status !== "CHECKED_IN") return { refusal: "BOOKING_NOT_WAITING" };
      if (!(await dispatchFrontGuide(tx, bookingId))) return { refusal: "NO_GUIDE_AVAILABLE" };
      return { booking: await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: coordinatorBookingInclude }) };
    });
    if ("refusal" in result) return refuse(response, result.refusal);
    return response.status(200).json(coordinatorBookingResponse(result.booking));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide assignment failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not assign a guide.");
  }
});

// Marks the trek completed; the guide rejoins the end of the queue.
coordinatorBookingsRouter.post("/:bookingId/complete", async (request, response) => {
  const { bookingId } = request.params;
  try {
    const result = await prisma.$transaction(async (tx): Promise<{ refusal: Refusal } | { booking: unknown }> => {
      const refusal = await completeTrek(tx, bookingId);
      if (refusal) return { refusal };
      return { booking: await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: coordinatorBookingInclude }) };
    });
    if ("refusal" in result) return refuse(response, result.refusal);
    return response.status(200).json(coordinatorBookingResponse(result.booking));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Trek completion failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not complete the trek.");
  }
});
