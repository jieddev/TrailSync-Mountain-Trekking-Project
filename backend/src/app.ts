import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";

import { httpLogger, logger, type AppLogger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";

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

app.post("/users", async (request, response) => {
  const log = requestLogger(request);
  const { firebaseUid, fullName, email, role } = request.body as Record<
    string,
    unknown
  >;

  if (
    typeof firebaseUid !== "string" ||
    typeof fullName !== "string" ||
    typeof email !== "string" ||
    !firebaseUid.trim() ||
    !fullName.trim() ||
    !email.trim()
  ) {
    log.warn(
      {
        requestId: requestId(request),
        hasFirebaseUid: typeof firebaseUid === "string" && Boolean(firebaseUid.trim()),
        hasFullName: typeof fullName === "string" && Boolean(fullName.trim()),
        hasEmail: typeof email === "string" && Boolean(email.trim()),
      },
      "User profile creation rejected because required fields were missing",
    );

    return response.status(400).json({
      message: "firebaseUid, fullName, and email are required strings.",
    });
  }

  if (
    role !== undefined &&
    role !== "HIKER" &&
    role !== "GUIDE" &&
    role !== "COORDINATOR"
  ) {
    log.warn(
      { requestId: requestId(request), role },
      "User profile creation rejected because role was invalid",
    );

    return response.status(400).json({
      message: "role must be HIKER, GUIDE, or COORDINATOR.",
    });
  }

  try {
    log.info(
      { requestId: requestId(request), role: role ?? "HIKER" },
      "User profile creation requested",
    );

    const user = await prisma.user.create({
      data: {
        firebaseUid: firebaseUid.trim(),
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        ...(role === undefined ? {} : { role }),
      },
    });

    log.info(
      { requestId: requestId(request), userId: user.id, role: user.role },
      "User profile created",
    );

    return response.status(201).json(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      log.warn(
        {
          requestId: requestId(request),
          prismaCode: error.code,
          target: error.meta?.target,
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
