import type { Response } from "express";

import { guideResponse, guideSelect } from "./guide-representation.js";
import { queuePosition, setAvailability, type AvailabilityStatus } from "./guide-queue.js";
import { fail } from "./http-errors.js";
import { prisma } from "./prisma.js";
import { asObject } from "./validation.js";

const AVAILABILITY_STATUSES: AvailabilityStatus[] = ["AVAILABLE", "OFF_DUTY"];

// POST .../availability for both the coordinator (any guide) and the guide (themselves).
export async function changeAvailability(response: Response, guideId: string, body: unknown) {
  const { status } = asObject(body);
  if (!AVAILABILITY_STATUSES.includes(status as AvailabilityStatus)) {
    return fail(response, 422, "VALIDATION_ERROR", "Review the availability and try again.", [
      { field: "status", code: "INVALID_STATUS", message: "Use AVAILABLE or OFF_DUTY." },
    ]);
  }
  const result = await prisma.$transaction(async (tx) => {
    const refusal = await setAvailability(tx, guideId, status as AvailabilityStatus);
    if (refusal) return { refusal };
    const guide = await tx.guide.findUniqueOrThrow({ where: { id: guideId }, select: guideSelect });
    return { guide: guideResponse(guide, await queuePosition(tx, guide)) };
  });
  if (result.refusal === "GUIDE_NOT_FOUND") return fail(response, 404, "GUIDE_NOT_FOUND", "Guide was not found.");
  if (result.refusal === "GUIDE_ON_TREK") return fail(response, 409, "GUIDE_ON_TREK", "This guide is on an assigned trek. Complete the trek first.");
  return response.status(200).json(result.guide);
}
