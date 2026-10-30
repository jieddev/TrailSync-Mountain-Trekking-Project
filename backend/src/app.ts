import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { CURRENT_TERMS_VERSION } from "./lib/agreements.js";
import { httpLogger, logger, type AppLogger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { isPrismaUniqueConstraintError } from "./lib/prisma-errors.js";
import { bookingsRouter } from "./routes/bookings.js";
import { coordinatorBookingsRouter } from "./routes/coordinator-bookings.js";
import { coordinatorGuideApplicationsRouter } from "./routes/coordinator-guide-applications.js";
import { coordinatorGuidesRouter } from "./routes/coordinator-guides.js";
import { coordinatorIncidentsRouter } from "./routes/coordinator-incidents.js";
import { coordinatorTrailRestrictionsRouter } from "./routes/coordinator-trail-restrictions.js";
import { guideApplicationsRouter } from "./routes/guide-applications.js";
import { guidesRouter } from "./routes/guides.js";
import { trailsRouter } from "./routes/trails.js";
import { weatherRouter } from "./routes/weather.js";
import {
  type AuthenticatedRequest,
  requireFirebaseAuth,
} from "./middleware/require-firebase-auth.js";

const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

export const app = express();

app.use(cors({ origin: corsOrigin }));
app.use(httpLogger);
app.use(express.json());

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.use("/api/v1/trails", trailsRouter);
app.use("/api/v1/bookings", bookingsRouter);
app.use("/api/v1/coordinator/bookings", coordinatorBookingsRouter);
app.use("/api/v1/guide-applications", guideApplicationsRouter);
app.use("/api/v1/coordinator/guide-applications", coordinatorGuideApplicationsRouter);
app.use("/api/v1/coordinator/guides", coordinatorGuidesRouter);
app.use("/api/v1/coordinator/trail-restrictions", coordinatorTrailRestrictionsRouter);
app.use("/api/v1/coordinator/incidents", coordinatorIncidentsRouter);
app.use("/api/v1/guides", guidesRouter);
app.use("/api/v1/weather", weatherRouter);

type RequestWithLogger = Request & {
  id?: string;
  log?: AppLogger;
};

const requestLogger = (request: Request): AppLogger =>
  (request as RequestWithLogger).log ?? logger;

const requestId = (request: Request): string | undefined =>
  (request as RequestWithLogger).id;

app.post("/users", requireFirebaseAuth, async (request, response) => {
  const log = requestLogger(request);
  const { fullName, acceptedTermsVersion } = request.body as Record<string, unknown>;
  const { authUser } = request as AuthenticatedRequest;

  if (typeof fullName !== "string" || !fullName.trim()) {
    log.warn(
      { requestId: requestId(request) },
      "User profile creation rejected because full name was missing",
    );

    return response.status(400).json({
      message: "fullName is required and must be a non-empty string.",
    });
  }

  if (acceptedTermsVersion !== CURRENT_TERMS_VERSION) {
    log.warn(
      { requestId: requestId(request) },
      "User profile creation rejected because the current terms were not accepted",
    );

    return response.status(400).json({
      message: "You must agree to the current Terms of Use and Privacy Policy.",
    });
  }

  if (!authUser?.email) {
    log.warn(
      { requestId: requestId(request), firebaseUid: authUser?.firebaseUid },
      "User profile creation rejected because verified account had no email",
    );

    return response.status(400).json({
      message: "The verified Firebase account must have an email address.",
    });
  }

  try {
    log.info(
      { requestId: requestId(request), firebaseUid: authUser.firebaseUid },
      "User profile creation requested",
    );

    const user = await prisma.user.create({
      data: {
        firebaseUid: authUser.firebaseUid,
        fullName: fullName.trim(),
        email: authUser.email.trim().toLowerCase(),
        termsAcceptedAt: new Date(),
        termsVersion: CURRENT_TERMS_VERSION,
      },
    });

    log.info(
      { requestId: requestId(request), userId: user.id, role: user.role },
      "User profile created",
    );

    return response.status(201).json(user);
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      log.warn(
        {
          requestId: requestId(request),
          prismaCode: (error as { code?: string }).code,
          target:
            error instanceof PrismaClientKnownRequestError
              ? error.meta?.target
              : undefined,
        },
        "User profile creation rejected because profile already exists",
      );

      return response.status(409).json({
        message: "A user with this Firebase UID or email already exists.",
      });
    }

    log.error(
      { requestId: requestId(request), err: error },
      "User profile creation failed",
    );

    return response.status(500).json({
      message: "Could not create user.",
      requestId: requestId(request),
    });
  }
});

app.get(["/users/me", "/api/v1/users/me"], requireFirebaseAuth, async (request, response) => {
  const log = requestLogger(request);
  const { authUser } = request as AuthenticatedRequest;

  if (!authUser) {
    return response.status(401).json({
      message: "A valid Firebase ID token is required.",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: authUser.firebaseUid },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      log.warn(
        { requestId: requestId(request), firebaseUid: authUser.firebaseUid },
        "Current user profile was not found",
      );

      return response.status(404).json({
        error: {
          code: "PROFILE_NOT_FOUND",
          message: "User profile was not found.",
        },
        requestId: requestId(request),
      });
    }

    return response.status(200).json(user);
  } catch (error) {
    log.error(
      { requestId: requestId(request), err: error },
      "Current user profile lookup failed",
    );

    return response.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not retrieve user profile.",
      },
      requestId: requestId(request),
    });
  }
});

app.use(
  (
    error: unknown,
    request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    requestLogger(request).error(
      { requestId: requestId(request), err: error },
      "Unhandled request error",
    );

    const malformedJson =
      error instanceof SyntaxError &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status?: number }).status === 400;
    response.status(malformedJson ? 400 : 500).json({
      error: {
        code: malformedJson ? "INVALID_JSON" : "INTERNAL_SERVER_ERROR",
        message: malformedJson ? "Request body must contain valid JSON." : "Internal server error.",
      },
      requestId: requestId(request),
    });
  },
);
