import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { httpLogger, logger, type AppLogger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
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
  const { fullName } = request.body as Record<string, unknown>;
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

function isPrismaUniqueConstraintError(error: unknown) {
  return (
    (error instanceof PrismaClientKnownRequestError ||
      (typeof error === "object" && error !== null && "code" in error)) &&
    (error as { code?: string }).code === "P2002"
  );
}

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

    response.status(500).json({
      message: "Internal server error.",
      requestId: requestId(request),
    });
  },
);
