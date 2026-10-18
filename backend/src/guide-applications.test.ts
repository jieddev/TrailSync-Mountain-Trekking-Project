import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/prisma.js", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    guideApplication: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));

import { app } from "./app.js";
import { firebaseAuth } from "./lib/firebase-admin.js";
import { prisma } from "./lib/prisma.js";

const verify = vi.mocked(firebaseAuth.verifyIdToken);
const userLookup = vi.mocked(prisma.user.findFirst);
const create = vi.mocked(prisma.guideApplication.create);
const findUnique = vi.mocked(prisma.guideApplication.findUnique);
const updateMany = vi.mocked(prisma.guideApplication.updateMany);
const application = (overrides: Record<string, unknown> = {}) => ({
  id: "application-1", fullName: "Trek Guide", email: "guide@example.com", status: "PENDING", declineReason: null,
  createdAt: new Date("2026-10-19T00:00:00Z"), ...overrides,
});
const submit = (body: unknown) => request(app).post("/api/v1/guide-applications").set("Authorization", "Bearer token").send(body as object);

beforeEach(() => {
  vi.resetAllMocks();
  verify.mockResolvedValue({ uid: "guide-uid", email: "Guide@Example.com" } as never);
  userLookup.mockResolvedValue(null);
  updateMany.mockResolvedValue({ count: 0 } as never);
});

describe("Guide applications", () => {
  it("requires a Firebase token but no TrailSync profile", async () => {
    expect((await request(app).post("/api/v1/guide-applications").send({ fullName: "Trek Guide" })).status).toBe(401);
    expect((await request(app).get("/api/v1/guide-applications/me")).status).toBe(401);
    create.mockResolvedValue(application() as never);
    expect((await submit({ fullName: "Trek Guide" })).status).toBe(201);
  });

  it("creates a pending request using the verified email", async () => {
    create.mockResolvedValue(application() as never);
    const response = await submit({ fullName: "  Trek Guide  " });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: "application-1", status: "PENDING" });
    expect(response.body).not.toHaveProperty("firebaseUid");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: { firebaseUid: "guide-uid", fullName: "Trek Guide", email: "guide@example.com" },
    }));
  });

  it("validates the full name and requires an email on the token", async () => {
    const blank = await submit({ fullName: "   " });
    expect(blank.status).toBe(422);
    expect(blank.body.error.details).toContainEqual(expect.objectContaining({ field: "fullName", code: "REQUIRED" }));
    verify.mockResolvedValueOnce({ uid: "guide-uid" } as never);
    const noEmail = await submit({ fullName: "Trek Guide" });
    expect(noEmail.status).toBe(400);
    expect(noEmail.body.error.code).toBe("EMAIL_REQUIRED");
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects callers who already have a TrailSync account", async () => {
    userLookup.mockResolvedValue({ id: "user-1" } as never);
    const response = await submit({ fullName: "Trek Guide" });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ACCOUNT_EXISTS");
    expect(userLookup).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ firebaseUid: "guide-uid" }, { email: "guide@example.com" }] },
    }));
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a second request while one is pending or approved", async () => {
    create.mockRejectedValue({ code: "P2002" });
    const response = await submit({ fullName: "Trek Guide" });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("APPLICATION_EXISTS");
  });

  it("puts a declined request back into review when the guide applies again", async () => {
    updateMany.mockResolvedValue({ count: 1 } as never);
    findUnique.mockResolvedValue(application() as never);
    const response = await submit({ fullName: "Trek Guide" });
    expect(response.status).toBe(201);
    expect(updateMany).toHaveBeenCalledWith({
      where: { firebaseUid: "guide-uid", status: "DECLINED" },
      data: { fullName: "Trek Guide", email: "guide@example.com", status: "PENDING", declineReason: null, reviewedById: null, reviewedAt: null },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns the caller's own request status", async () => {
    findUnique.mockResolvedValueOnce(application({ status: "DECLINED", declineReason: "Missing accreditation" }) as never);
    const found = await request(app).get("/api/v1/guide-applications/me").set("Authorization", "Bearer token");
    expect(found.status).toBe(200);
    expect(found.body).toMatchObject({ status: "DECLINED", declineReason: "Missing accreditation" });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { firebaseUid: "guide-uid" } }));
    findUnique.mockResolvedValueOnce(null);
    const missing = await request(app).get("/api/v1/guide-applications/me").set("Authorization", "Bearer token");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("APPLICATION_NOT_FOUND");
  });
});
