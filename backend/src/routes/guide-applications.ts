import { Router } from "express";

import { fail } from "../lib/http-errors.js";
import { prisma } from "../lib/prisma.js";
import { isPrismaUniqueConstraintError } from "../lib/prisma-errors.js";
import { requireFirebaseAuth, type AuthenticatedRequest } from "../middleware/require-firebase-auth.js";

// What an applicant may see about their own request.
const applicantSelect = { id: true, fullName: true, email: true, status: true, declineReason: true, createdAt: true } as const;

// Used by the guide app. Applicants have a Firebase login but no TrailSync
// profile yet, so these routes check only the token, never a role.
export const guideApplicationsRouter = Router();
guideApplicationsRouter.use(requireFirebaseAuth);

guideApplicationsRouter.post("/", async (request, response) => {
  const { authUser } = request as AuthenticatedRequest;
  if (!authUser) return fail(response, 401, "UNAUTHORIZED", "Authentication is required.");
  const body = request.body && typeof request.body === "object" && !Array.isArray(request.body) ? request.body as Record<string, unknown> : {};
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  if (!fullName) {
    return fail(response, 422, "VALIDATION_ERROR", "Review the request details and try again.", [
      { field: "fullName", code: "REQUIRED", message: "Enter your full name." },
    ]);
  }
  if (!authUser.email) return fail(response, 400, "EMAIL_REQUIRED", "The verified Firebase account must have an email address.");
  const email = authUser.email.trim().toLowerCase();

  try {
    const existingUser = await prisma.user.findFirst({ where: { OR: [{ firebaseUid: authUser.firebaseUid }, { email }] }, select: { id: true } });
    if (existingUser) return fail(response, 409, "ACCOUNT_EXISTS", "A TrailSync account already exists for this login.");

    // A declined applicant may apply again; their request goes back to review.
    const reapplied = await prisma.guideApplication.updateMany({
      where: { firebaseUid: authUser.firebaseUid, status: "DECLINED" },
      data: { fullName, email, status: "PENDING", declineReason: null, reviewedById: null, reviewedAt: null },
    });
    const application = reapplied.count
      ? await prisma.guideApplication.findUnique({ where: { firebaseUid: authUser.firebaseUid }, select: applicantSelect })
      : await prisma.guideApplication.create({ data: { firebaseUid: authUser.firebaseUid, fullName, email }, select: applicantSelect });
    return response.status(201).json(application);
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) return fail(response, 409, "APPLICATION_EXISTS", "A guide account request already exists for this login.");
    request.log?.error({ requestId: request.id, err: error }, "Guide application creation failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not submit the guide account request.");
  }
});

guideApplicationsRouter.get("/me", async (request, response) => {
  const { authUser } = request as AuthenticatedRequest;
  if (!authUser) return fail(response, 401, "UNAUTHORIZED", "Authentication is required.");
  try {
    const application = await prisma.guideApplication.findUnique({ where: { firebaseUid: authUser.firebaseUid }, select: applicantSelect });
    if (!application) return fail(response, 404, "APPLICATION_NOT_FOUND", "No guide account request was found.");
    return response.status(200).json(application);
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Guide application lookup failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not retrieve the guide account request.");
  }
});
