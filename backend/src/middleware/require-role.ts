import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";

import { fail } from "../lib/http-errors.js";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedRequest } from "./require-firebase-auth.js";

export type RoleRequest = AuthenticatedRequest & {
  profile?: { id: string; fullName: string; role: UserRole };
};

// Runs after requireFirebaseAuth. Loads the caller's TrailSync profile from the
// verified Firebase UID and rejects callers whose stored role is not allowed.
export function requireRole(...roles: UserRole[]) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const roleRequest = request as RoleRequest;
    if (!roleRequest.authUser) return fail(response, 401, "UNAUTHORIZED", "Authentication is required.");
    try {
      const profile = await prisma.user.findUnique({
        where: { firebaseUid: roleRequest.authUser.firebaseUid },
        select: { id: true, fullName: true, role: true },
      });
      if (!profile) return fail(response, 404, "PROFILE_NOT_FOUND", "User profile was not found.");
      if (!roles.includes(profile.role)) return fail(response, 403, "FORBIDDEN", "You do not have access to this resource.");
      roleRequest.profile = profile;
      return next();
    } catch (error) {
      request.log?.error({ requestId: request.id, err: error }, "Role lookup failed");
      return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not verify access.");
    }
  };
}
