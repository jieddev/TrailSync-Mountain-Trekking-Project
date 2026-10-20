import { Router, type Request, type Response } from "express";
import type { GuideApplicationStatus } from "@prisma/client";

import { fail } from "../lib/http-errors.js";
import { prisma } from "../lib/prisma.js";
import { isPrismaUniqueConstraintError } from "../lib/prisma-errors.js";
import { requireFirebaseAuth } from "../middleware/require-firebase-auth.js";
import { requireRole, type RoleRequest } from "../middleware/require-role.js";

const APPLICATION_STATUSES: GuideApplicationStatus[] = ["PENDING", "APPROVED", "DECLINED"];
const MAX_DECLINE_REASON_LENGTH = 500;

const applicationSelect = {
  id: true, fullName: true, email: true, status: true, declineReason: true, reviewedAt: true, createdAt: true,
  reviewedBy: { select: { id: true, fullName: true } },
} as const;

// A request that could not be moved out of PENDING is either missing or already reviewed.
async function notPending(response: Response, applicationId: string) {
  const existing = await prisma.guideApplication.findUnique({ where: { id: applicationId }, select: { id: true } });
  return existing
    ? fail(response, 409, "APPLICATION_NOT_PENDING", "This request has already been reviewed.")
    : fail(response, 404, "APPLICATION_NOT_FOUND", "Guide account request was not found.");
}

const reviewerId = (request: Request) => (request as RoleRequest).profile!.id;

export const coordinatorGuideApplicationsRouter = Router();
coordinatorGuideApplicationsRouter.use(requireFirebaseAuth, requireRole("COORDINATOR"));

coordinatorGuideApplicationsRouter.get("/", async (request, response) => {
  const { status } = request.query;
  if (status !== undefined && !APPLICATION_STATUSES.includes(status as GuideApplicationStatus)) {
    return fail(response, 422, "VALIDATION_ERROR", "Review the request filters and try again.", [
      { field: "status", code: "INVALID_STATUS", message: "Use PENDING, APPROVED, or DECLINED." },
    ]);
  }
  try {
    const applications = await prisma.guideApplication.findMany({
      where: status === undefined ? {} : { status: status as GuideApplicationStatus },
      select: applicationSelect,
      orderBy: { createdAt: "asc" },
    });
    return response.status(200).json({ items: applications });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide application list failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve guide account requests.");
  }
});

// Approving creates the guide's TrailSync account and their (off-duty) dispatch
// row in the same transaction, so a request is never APPROVED without its GUIDE
// user (or the reverse).
coordinatorGuideApplicationsRouter.post("/:applicationId/approve", async (request, response) => {
  const { applicationId } = request.params;
  try {
    const application = await prisma.$transaction(async (tx) => {
      const updated = await tx.guideApplication.updateMany({
        where: { id: applicationId, status: "PENDING" },
        data: { status: "APPROVED", reviewedById: reviewerId(request), reviewedAt: new Date() },
      });
      if (!updated.count) return null;
      const approved = await tx.guideApplication.findUniqueOrThrow({ where: { id: applicationId }, select: { ...applicationSelect, firebaseUid: true } });
      await tx.user.create({
        data: { firebaseUid: approved.firebaseUid, fullName: approved.fullName, email: approved.email, role: "GUIDE", guide: { create: {} } },
      });
      const { firebaseUid: _firebaseUid, ...result } = approved;
      return result;
    });
    if (!application) return notPending(response, applicationId);
    return response.status(200).json(application);
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) return fail(response, 409, "ACCOUNT_EXISTS", "A TrailSync account already exists for this guide's login or email.");
    request.log?.error({ requestId: request.id, err: error }, "Guide application approval failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not approve the guide account request.");
  }
});

coordinatorGuideApplicationsRouter.post("/:applicationId/decline", async (request, response) => {
  const { applicationId } = request.params;
  const body = request.body && typeof request.body === "object" && !Array.isArray(request.body) ? request.body as Record<string, unknown> : {};
  if (body.reason !== undefined && body.reason !== null && typeof body.reason !== "string") {
    return fail(response, 422, "VALIDATION_ERROR", "Review the decline reason and try again.", [
      { field: "reason", code: "INVALID_REASON", message: "The reason must be text." },
    ]);
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length > MAX_DECLINE_REASON_LENGTH) {
    return fail(response, 422, "VALIDATION_ERROR", "Review the decline reason and try again.", [
      { field: "reason", code: "TOO_LONG", message: `Keep the reason to ${MAX_DECLINE_REASON_LENGTH} characters or fewer.` },
    ]);
  }
  try {
    const updated = await prisma.guideApplication.updateMany({
      where: { id: applicationId, status: "PENDING" },
      data: { status: "DECLINED", declineReason: reason || null, reviewedById: reviewerId(request), reviewedAt: new Date() },
    });
    if (!updated.count) return notPending(response, applicationId);
    const application = await prisma.guideApplication.findUnique({ where: { id: applicationId }, select: applicationSelect });
    return response.status(200).json(application);
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide application decline failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not decline the guide account request.");
  }
});
