import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    guideApplication: { findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { app } from "./app.js";
import { firebaseAuth } from "./lib/firebase-admin.js";
import { prisma } from "./lib/prisma.js";

const verify = vi.mocked(firebaseAuth.verifyIdToken);
const userLookup = vi.mocked(prisma.user.findUnique);
const userCreate = vi.mocked(prisma.user.create);
const findMany = vi.mocked(prisma.guideApplication.findMany);
const findUnique = vi.mocked(prisma.guideApplication.findUnique);
const findUniqueOrThrow = vi.mocked(prisma.guideApplication.findUniqueOrThrow);
const updateMany = vi.mocked(prisma.guideApplication.updateMany);
const transaction = vi.mocked(prisma.$transaction);
const coordinator = { id: "coordinator-1", fullName: "Office Coordinator", role: "COORDINATOR" };
const application = (overrides: Record<string, unknown> = {}) => ({
  id: "application-1", fullName: "Trek Guide", email: "guide@example.com", status: "PENDING", declineReason: null,
  reviewedAt: null, reviewedBy: null, createdAt: new Date("2026-10-19T00:00:00Z"), ...overrides,
});
const base = "/api/v1/coordinator/guide-applications";
const get = (path: string) => request(app).get(path).set("Authorization", "Bearer token");
const post = (path: string, body: object = {}) => request(app).post(path).set("Authorization", "Bearer token").send(body);

beforeEach(() => {
  vi.resetAllMocks();
  verify.mockResolvedValue({ uid: "verified-uid" } as never);
  userLookup.mockResolvedValue(coordinator as never);
  transaction.mockImplementation(async (callback: any) => callback(prisma) as never);
});

describe("Coordinator guide applications", () => {
  it("requires a token, a profile, and the coordinator role", async () => {
    expect((await request(app).get(base)).status).toBe(401);
    userLookup.mockResolvedValueOnce(null);
    expect((await get(base)).body.error.code).toBe("PROFILE_NOT_FOUND");
    for (const role of ["HIKER", "GUIDE"]) {
      userLookup.mockResolvedValueOnce({ ...coordinator, role } as never);
      const response = await post(`${base}/application-1/approve`);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }
    expect(findMany).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("lists requests oldest first, filtered by status", async () => {
    findMany.mockResolvedValue([application()] as never);
    const response = await get(`${base}?status=PENDING`);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).not.toHaveProperty("firebaseUid");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } }));
    const invalid = await get(`${base}?status=CANCELLED`);
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.details).toContainEqual(expect.objectContaining({ field: "status", code: "INVALID_STATUS" }));
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("approves a pending request and creates the GUIDE account", async () => {
    updateMany.mockResolvedValue({ count: 1 } as never);
    findUniqueOrThrow.mockResolvedValue({ ...application({ status: "APPROVED" }), firebaseUid: "guide-uid" } as never);
    const response = await post(`${base}/application-1/approve`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "application-1", status: "APPROVED" });
    expect(response.body).not.toHaveProperty("firebaseUid");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "application-1", status: "PENDING" },
      data: { status: "APPROVED", reviewedById: "coordinator-1", reviewedAt: expect.any(Date) },
    });
    expect(userCreate).toHaveBeenCalledWith({ data: { firebaseUid: "guide-uid", fullName: "Trek Guide", email: "guide@example.com", role: "GUIDE" } });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when the guide's login or email already has an account", async () => {
    updateMany.mockResolvedValue({ count: 1 } as never);
    findUniqueOrThrow.mockResolvedValue({ ...application(), firebaseUid: "guide-uid" } as never);
    userCreate.mockRejectedValue({ code: "P2002" });
    const response = await post(`${base}/application-1/approve`);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ACCOUNT_EXISTS");
  });

  it("declines a pending request with an optional trimmed reason", async () => {
    updateMany.mockResolvedValue({ count: 1 } as never);
    findUnique.mockResolvedValue(application({ status: "DECLINED", declineReason: "Missing accreditation" }) as never);
    const response = await post(`${base}/application-1/decline`, { reason: "  Missing accreditation  " });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "DECLINED", declineReason: "Missing accreditation" });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "application-1", status: "PENDING" },
      data: { status: "DECLINED", declineReason: "Missing accreditation", reviewedById: "coordinator-1", reviewedAt: expect.any(Date) },
    });
    await post(`${base}/application-1/decline`);
    expect(updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ declineReason: null }) }));
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("validates the decline reason", async () => {
    const tooLong = await post(`${base}/application-1/decline`, { reason: "x".repeat(501) });
    expect(tooLong.status).toBe(422);
    expect(tooLong.body.error.details).toContainEqual(expect.objectContaining({ field: "reason", code: "TOO_LONG" }));
    const notText = await post(`${base}/application-1/decline`, { reason: 42 });
    expect(notText.status).toBe(422);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("returns 409 for already-reviewed requests and 404 for unknown ones", async () => {
    updateMany.mockResolvedValue({ count: 0 } as never);
    for (const action of ["approve", "decline"]) {
      findUnique.mockResolvedValueOnce({ id: "application-1" } as never);
      const reviewed = await post(`${base}/application-1/${action}`);
      expect(reviewed.status).toBe(409);
      expect(reviewed.body.error.code).toBe("APPLICATION_NOT_PENDING");
      findUnique.mockResolvedValueOnce(null);
      const missing = await post(`${base}/unknown/${action}`);
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe("APPLICATION_NOT_FOUND");
    }
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("hides database failures behind a safe error", async () => {
    findMany.mockRejectedValue(new Error("connection refused at 10.0.0.1"));
    const response = await get(base);
    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({ code: "INTERNAL_SERVER_ERROR", message: "Could not retrieve guide account requests." });
  });
});
