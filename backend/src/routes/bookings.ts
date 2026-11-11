import { Router, type Response } from "express";
import { CURRENT_WAIVER_VERSION } from "../lib/agreements.js";
import { fail, type ErrorDetail as Details } from "../lib/http-errors.js";
import { bookingInclude, withTrailRestriction, withTrailRestrictions } from "../lib/booking-representation.js";
import { MAX_PARTICIPANTS, MIN_BOOKING_OWNER_AGE, MIN_PARTICIPANT_AGE, PAYMENT_OPTIONS, amountDueOnline, isPaymentOption, pricingFor } from "../lib/package-policy.js";
import { prisma } from "../lib/prisma.js";
import { deleteReceiptFile, parseReceiptSubmission, receiptUpload, saveReceiptFile, sendReceiptFile } from "../lib/receipt-upload.js";
import { activeRestriction } from "../lib/trail-restrictions.js";
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

function trailRestricted(response: Response) {
  return fail(response, 409, "TRAIL_RESTRICTED", "This trail is closed on the selected date. Choose another date.");
}

async function currentProfile(request: AuthenticatedRequest) {
  if (!request.authUser) return { error: "UNAUTHORIZED" as const };
  const user = await prisma.user.findUnique({
    where: { firebaseUid: request.authUser.firebaseUid },
    select: { id: true, fullName: true, email: true, age: true, role: true },
  });
  return user ?? { error: "PROFILE_NOT_FOUND" as const };
}

// Thrown inside a transaction to roll it back when a guarded update loses a race.
class Conflict extends Error {}

// The booking fields arrive as JSON in the multipart "booking" field, next to
// the receipt file. A plain JSON body is read the same way.
function bookingBody(body: unknown): Record<string, unknown> | null {
  const raw = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  if (typeof raw.booking !== "string") return raw;
  try {
    const parsed = JSON.parse(raw.booking);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function formField(body: unknown, name: string) {
  return body && typeof body === "object" ? (body as Record<string, unknown>)[name] : undefined;
}

export const bookingsRouter = Router();
bookingsRouter.use(requireFirebaseAuth);

bookingsRouter.post("/", receiptUpload, async (request, response) => {
  let storedFileName: string | null = null;
  try {
    const profile = await currentProfile(request as AuthenticatedRequest);
    if ("error" in profile) return fail(response, profile.error === "UNAUTHORIZED" ? 401 : 404, profile.error, profile.error === "PROFILE_NOT_FOUND" ? "User profile was not found." : "Authentication is required.");
    if (profile.role !== "HIKER") return fail(response, 403, "FORBIDDEN", "Only hikers can create bookings.");

    const body = bookingBody(request.body);
    if (!body) return validation(response, [{ field: "booking", code: "INVALID_JSON", message: "Booking details must be valid JSON." }]);
    const details: Details[] = [];
    if (!nonblank(body.trailId)) details.push({ field: "trailId", code: "REQUIRED", message: "Select a trail." });
    details.push(...validateSchedule(body));
    const ownerDetails = body.ownerDetails && typeof body.ownerDetails === "object" && !Array.isArray(body.ownerDetails) ? body.ownerDetails as Record<string, unknown> : {};
    // The owner's age is the one saved at registration; a client-sent age is ignored.
    const ownerAge = profile.age;
    if (ownerAge === null) details.push({ field: "ownerAge", code: "PROFILE_AGE_MISSING", message: "Your account has no age saved, so it can't book yet. Contact the tourism office to add it." });
    else if (ownerAge < MIN_BOOKING_OWNER_AGE) details.push({ field: "ownerAge", code: "OWNER_UNDERAGE", message: `The person booking must be ${MIN_BOOKING_OWNER_AGE} or older.` });
    if (!nonblank(ownerDetails.address)) details.push({ field: "ownerDetails.address", code: "REQUIRED", message: "Address is required." });
    const additional = body.additionalParticipants === undefined ? [] : body.additionalParticipants;
    if (!Array.isArray(additional)) details.push({ field: "additionalParticipants", code: "INVALID_TYPE", message: "Additional participants must be an array." });
    else {
      if (additional.length > MAX_PARTICIPANTS - 1) details.push({ field: "additionalParticipants", code: "PARTICIPANT_LIMIT_EXCEEDED", message: "A package can include at most five participants, including the booking owner." });
      additional.forEach((item, index) => {
        const person = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
        if (!nonblank(person.name)) details.push({ field: `additionalParticipants.${index}.name`, code: "REQUIRED", message: "Name is required." });
        if (!validAge(person.age)) details.push({ field: `additionalParticipants.${index}.age`, code: "INVALID_AGE", message: "Age must be a positive integer." });
        else if (person.age < MIN_PARTICIPANT_AGE) details.push({ field: `additionalParticipants.${index}.age`, code: "PARTICIPANT_UNDERAGE", message: `Every participant must be ${MIN_PARTICIPANT_AGE} or older.` });
        if (!nonblank(person.address)) details.push({ field: `additionalParticipants.${index}.address`, code: "REQUIRED", message: "Address is required." });
        if (!validOptionalEmail(person.email)) details.push({ field: `additionalParticipants.${index}.email`, code: "INVALID_EMAIL", message: "Enter a valid email address." });
      });
    }
    if (!isPaymentOption(body.paymentOption)) details.push({ field: "paymentOption", code: "INVALID_PAYMENT_OPTION", message: `Choose ${PAYMENT_OPTIONS.join(" or ")}.` });
    if (body.acceptedWaiverVersion !== CURRENT_WAIVER_VERSION) details.push({ field: "acceptedWaiverVersion", code: "WAIVER_NOT_ACCEPTED", message: "Agree to the Trek Waiver and Trail Rules to book." });
    const submission = parseReceiptSubmission(request.file, formField(request.body, "referenceNumber"));
    if ("details" in submission) details.push(...submission.details);
    if (details.length || "details" in submission) return validation(response, details);
    const paymentOption = body.paymentOption as "DOWNPAYMENT" | "FULL";

    const trail = await prisma.trail.findFirst({ where: { id: body.trailId as string, isActive: true }, select: { id: true, packagePrice: true, garbageFee: true, environmentalFee: true, entranceFeePerPerson: true } });
    if (!trail) return validation(response, [{ field: "trailId", code: "UNSUPPORTED_TRAIL", message: "Select a supported trail." }]);

    const { totalAmount: _totalAmount, ...pricing } = pricingFor(trail, 1 + (additional as unknown[]).length);
    storedFileName = await saveReceiptFile(submission.receipt);
    const receiptFile = { storedFileName, mimeType: submission.receipt.mimeType, sizeBytes: submission.receipt.sizeBytes };
    const booking = await prisma.$transaction(async (tx) => {
      if (await activeRestriction(tx, trail.id, body.scheduledDate as string)) return null;
      return tx.booking.create({
        data: {
          ownerId: profile.id,
          trailId: trail.id,
          scheduledDate: body.scheduledDate as string,
          scheduledTime: body.scheduledTime as string,
          packagePrice: trail.packagePrice,
          ...pricing,
          paymentOption,
          status: "PENDING_CONFIRMATION",
          downpaymentStatus: "PENDING_VERIFICATION",
          paymentReceipts: { create: [{
            amount: amountDueOnline({ packagePrice: trail.packagePrice, ...pricing, paymentOption }),
            referenceNumber: submission.receipt.referenceNumber,
            ...receiptFile,
          }] },
          waiverAcceptedAt: new Date(),
          waiverVersion: CURRENT_WAIVER_VERSION,
          participants: { create: [
            { kind: "BOOKING_OWNER", name: profile.fullName, age: ownerAge as number, address: (ownerDetails.address as string).trim(), email: profile.email },
            ...(additional as Record<string, unknown>[]).map((person) => ({
              kind: "ADDITIONAL_PARTICIPANT" as const,
              name: (person.name as string).trim(), age: person.age as number, address: (person.address as string).trim(),
              email: optionalEmail(person.email),
            })),
          ] },
        }, include: bookingInclude,
      });
    });
    if (!booking) {
      await deleteReceiptFile(storedFileName);
      return trailRestricted(response);
    }
    storedFileName = null;
    return response.status(201).json(await withTrailRestriction(prisma, booking));
  } catch (error) {
    if (storedFileName) await deleteReceiptFile(storedFileName).catch(() => undefined);
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
    return response.status(200).json({ items: await withTrailRestrictions(prisma, bookings) });
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
    return response.status(200).json(await withTrailRestriction(prisma, booking));
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
      const owned = await tx.booking.findFirst({ where: { id: request.params.bookingId, ownerId: profile.id }, select: { trailId: true } });
      if (owned && await activeRestriction(tx, owned.trailId, body.scheduledDate as string)) return "TRAIL_RESTRICTED" as const;
      const updated = await tx.booking.updateMany({
        where: { id: request.params.bookingId, ownerId: profile.id, status: "CONFIRMED" },
        data: { scheduledDate: body.scheduledDate as string, scheduledTime: body.scheduledTime as string, status: "PENDING_CONFIRMATION" },
      });
      if (!updated.count) return null;
      return tx.booking.findFirst({ where: { id: request.params.bookingId, ownerId: profile.id }, include: bookingInclude });
    });
    if (booking === "TRAIL_RESTRICTED") return trailRestricted(response);
    if (!booking) {
      const owned = await prisma.booking.findFirst({ where: { id: request.params.bookingId, ownerId: profile.id }, select: { id: true } });
      return owned ? fail(response, 409, "RESCHEDULE_NOT_ALLOWED", "Booking cannot be rescheduled in its current state.") : fail(response, 404, "BOOKING_NOT_FOUND", "Booking was not found.");
    }
    return response.status(200).json(await withTrailRestriction(prisma, booking));
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Booking reschedule failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not reschedule booking.");
  }
});

// Coordinator accepts the payment and confirms the booking. A new booking needs
// a receipt awaiting review, which is marked ACCEPTED. A rescheduled booking
// already has a VERIFIED payment and is confirmed again without a new receipt.
bookingsRouter.post("/:bookingId/confirm", async (request, response) => {
  try {
    const profile = await currentProfile(request as AuthenticatedRequest);
    if ("error" in profile) return fail(response, profile.error === "UNAUTHORIZED" ? 401 : 404, profile.error, profile.error === "PROFILE_NOT_FOUND" ? "User profile was not found." : "Authentication is required.");
    if (profile.role !== "COORDINATOR") return fail(response, 403, "FORBIDDEN", "Coordinator access is required.");
    const { bookingId } = request.params;
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { status: true, downpaymentStatus: true, paymentReceipts: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } } },
      });
      if (!current) return "BOOKING_NOT_FOUND" as const;
      const latest = current.paymentReceipts?.[0];
      const awaitingReview = current.downpaymentStatus === "PENDING_VERIFICATION" && latest?.status === "SUBMITTED";
      if (current.status !== "PENDING_CONFIRMATION" || !(awaitingReview || current.downpaymentStatus === "VERIFIED")) return "BOOKING_NOT_CONFIRMABLE" as const;
      const updated = await tx.booking.updateMany({
        where: { id: bookingId, status: "PENDING_CONFIRMATION", downpaymentStatus: current.downpaymentStatus },
        data: { status: "CONFIRMED", downpaymentStatus: "VERIFIED" },
      });
      if (!updated.count) return "BOOKING_NOT_CONFIRMABLE" as const;
      if (awaitingReview) {
        const accepted = await tx.paymentReceipt.updateMany({
          where: { id: latest!.id, status: "SUBMITTED" },
          data: { status: "ACCEPTED", reviewedAt: new Date(), reviewedById: profile.id },
        });
        if (!accepted.count) throw new Conflict();
      }
      return tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: bookingInclude });
    });
    if (result === "BOOKING_NOT_FOUND") return fail(response, 404, "BOOKING_NOT_FOUND", "Booking was not found.");
    if (result === "BOOKING_NOT_CONFIRMABLE") return fail(response, 409, "BOOKING_NOT_CONFIRMABLE", "Booking cannot be confirmed in its current state.");
    return response.status(200).json(await withTrailRestriction(prisma, result));
  } catch (error) {
    if (error instanceof Conflict) return fail(response, 409, "BOOKING_NOT_CONFIRMABLE", "Booking cannot be confirmed in its current state.");
    request.log?.error({ requestId: request.id, err: error }, "Booking confirmation failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not confirm booking.");
  }
});

// The owner uploads a new screenshot after the coordinator rejected the last one.
bookingsRouter.post("/:bookingId/payment-receipt", receiptUpload, async (request, response) => {
  let storedFileName: string | null = null;
  try {
    const profile = await currentProfile(request as AuthenticatedRequest);
    if ("error" in profile) return fail(response, profile.error === "UNAUTHORIZED" ? 401 : 404, profile.error, profile.error === "PROFILE_NOT_FOUND" ? "User profile was not found." : "Authentication is required.");
    if (profile.role !== "HIKER") return fail(response, 403, "FORBIDDEN", "Only hikers can upload payment receipts.");
    const submission = parseReceiptSubmission(request.file, formField(request.body, "referenceNumber"));
    if ("details" in submission) return fail(response, 422, "VALIDATION_ERROR", "Review the payment receipt and try again.", submission.details);
    const bookingId = request.params.bookingId as string;
    const owned = await prisma.booking.findFirst({
      where: { id: bookingId, ownerId: profile.id },
      select: { status: true, downpaymentStatus: true, packagePrice: true, garbageFee: true, environmentalFee: true, entranceFee: true, downpaymentAmount: true, paymentOption: true },
    });
    if (!owned) return fail(response, 404, "BOOKING_NOT_FOUND", "Booking was not found.");
    const uploadNotAllowed = () => fail(response, 409, "RECEIPT_UPLOAD_NOT_ALLOWED", "A new receipt can be uploaded only after the coordinator rejects the last one.");
    if (owned.status !== "PENDING_CONFIRMATION" || owned.downpaymentStatus !== "REJECTED") return uploadNotAllowed();

    storedFileName = await saveReceiptFile(submission.receipt);
    const receiptFile = { storedFileName, mimeType: submission.receipt.mimeType, sizeBytes: submission.receipt.sizeBytes };
    const booking = await prisma.$transaction(async (tx) => {
      const reopened = await tx.booking.updateMany({
        where: { id: bookingId, ownerId: profile.id, status: "PENDING_CONFIRMATION", downpaymentStatus: "REJECTED" },
        data: { downpaymentStatus: "PENDING_VERIFICATION" },
      });
      if (!reopened.count) return null;
      await tx.paymentReceipt.create({
        data: { bookingId, amount: amountDueOnline(owned), referenceNumber: submission.receipt.referenceNumber, ...receiptFile },
      });
      return tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: bookingInclude });
    });
    if (!booking) {
      await deleteReceiptFile(storedFileName);
      return uploadNotAllowed();
    }
    storedFileName = null;
    return response.status(201).json(await withTrailRestriction(prisma, booking));
  } catch (error) {
    if (storedFileName) await deleteReceiptFile(storedFileName).catch(() => undefined);
    request.log?.error({ requestId: request.id, err: error }, "Payment receipt upload failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not upload the payment receipt.");
  }
});

// The owner's own receipt screenshot.
bookingsRouter.get("/:bookingId/payment-receipts/:receiptId/file", async (request, response) => {
  try {
    const profile = await currentProfile(request as AuthenticatedRequest);
    if ("error" in profile) return fail(response, profile.error === "UNAUTHORIZED" ? 401 : 404, profile.error, profile.error === "PROFILE_NOT_FOUND" ? "User profile was not found." : "Authentication is required.");
    if (profile.role !== "HIKER") return fail(response, 403, "FORBIDDEN", "Only hikers can view their receipts here.");
    const receipt = await prisma.paymentReceipt.findFirst({
      where: { id: request.params.receiptId, bookingId: request.params.bookingId, booking: { ownerId: profile.id } },
      select: { storedFileName: true, mimeType: true },
    });
    if (!receipt) return fail(response, 404, "RECEIPT_NOT_FOUND", "Receipt was not found.");
    return sendReceiptFile(response, receipt);
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Payment receipt lookup failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve the receipt.");
  }
});
