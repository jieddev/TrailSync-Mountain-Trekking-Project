import cors from "cors";
import express from "express";
import { Prisma } from "@prisma/client";

import { prisma } from "./lib/prisma.js";

const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

export const app = express();

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.post("/users", async (request, response) => {
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
    return response.status(400).json({
      message: "role must be HIKER, GUIDE, or COORDINATOR.",
    });
  }

  try {
    const user = await prisma.user.create({
      data: {
        firebaseUid: firebaseUid.trim(),
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        ...(role === undefined ? {} : { role }),
      },
    });

    return response.status(201).json(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return response.status(409).json({
        message: "A user with this Firebase UID or email already exists.",
      });
    }

    return response.status(500).json({ message: "Could not create user." });
  }
});
