import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    trail: { findFirst: vi.fn() },
    trailRestriction: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  },
}));

import { app } from "./app.js";
import { firebaseAuth } from "./lib/firebase-admin.js";
import { prisma } from "./lib/prisma.js";

const verify = vi.mocked(firebaseAuth.verifyIdToken);
const userLookup = vi.mocked(prisma.user.findUnique);
const trailLookup = vi.mocked(prisma.trail.findFirst);
const findRestrictions = vi.mocked(prisma.trailRestriction.findMany);
const findRestriction = vi.mocked(prisma.trailRestriction.findUnique);
const createRestriction = vi.mocked(prisma.trailRestriction.create);
const updateRestrictions = vi.mocked(prisma.trailRestriction.updateMany);
const coordinator = { id: "coordinator-1", fullName: "Office Coordinator", role: "COORDINATOR" };
const base = "/api/v1/coordinator/trail-restrictions";
const restriction = (overrides: Record<string, unknown> = {}) => ({
  id: "restriction-1", trailId: "trl_sulfatara", startDate: "2026-10-20", endDate: "2026-10-21", reason: "Heavy rain advisory",
  liftedAt: null, createdAt: new Date("2026-10-19T10:00:00Z"),
  trail: { id: "trl_sulfatara", name: "Sulfatara" },
  createdBy: { id: "coordinator-1", fullName: "Office Coordinator" },
  liftedBy: null,
  ...overrides,
});
const validBody = { trailId: "trl_sulfatara", startDate: "2026-10-20", endDate: "2026-10-21", reason: "  Heavy rain advisory  " };
const post = (path: string, body: object = {}) => request(app).post(path).set("Authorization", "Bearer token").send(body);
const get = (path: string) => request(app).get(path).set("Authorization", "Bearer token");

beforeEach(() => {
  vi.resetAllMocks();
  // 08:30 on 2026-10-20 in Manila.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T00:30:00Z"));
  verify.mockResolvedValue({ uid: "verified-uid" } as never);
  userLookup.mockResolvedValue(coordinator as never);
  trailLookup.mockResolvedValue({ id: "trl_sulfatara" } as never);
  createRestriction.mockResolvedValue(restriction() as never);
  updateRestrictions.mockResolvedValue({ count: 1 } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Coordinator restricts a trail", () => {
  it("requires the coordinator role", async () => {
    expect((await request(app).post(base).send(validBody)).status).toBe(401);
    for (const role of ["HIKER", "GUIDE"]) {
      userLookup.mockResolvedValueOnce({ ...coordinator, role } as never);
      expect((await post(base, validBody)).status).toBe(403);
    }
    expect(createRestriction).not.toHaveBeenCalled();
  });

  it("creates a restriction recorded against the verified coordinator", async () => {
    const response = await post(base, { ...validBody, createdById: "someone-else" });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: "restriction-1", trail: { id: "trl_sulfatara", name: "Sulfatara" }, startDate: "2026-10-20", endDate: "2026-10-21",
      status: "ACTIVE", createdBy: { fullName: "Office Coordinator" }, liftedAt: null, liftedBy: null,
    });
    expect(createRestriction).toHaveBeenCalledWith(expect.objectContaining({
      data: { trailId: "trl_sulfatara", startDate: "2026-10-20", endDate: "2026-10-21", reason: "Heavy rain advisory", createdById: "coordinator-1" },
    }));
  });

  it("validates the dates and reason", async () => {
    const codes = async (body: object) => (await post(base, body)).body.error.details.map((detail: { code: string }) => detail.code);
    expect(await codes({})).toEqual(["REQUIRED", "INVALID_DATE", "INVALID_DATE", "REQUIRED"]);
    expect(await codes({ ...validBody, startDate: "2026-10-22", endDate: "2026-10-21" })).toEqual(["END_BEFORE_START"]);
    expect(await codes({ ...validBody, startDate: "2026-10-18", endDate: "2026-10-19" })).toEqual(["DATE_IN_PAST"]);
    expect(await codes({ ...validBody, endDate: "2026-02-30" })).toEqual(["INVALID_DATE"]);
    expect(await codes({ ...validBody, reason: "x".repeat(501) })).toEqual(["TOO_LONG"]);
    expect(createRestriction).not.toHaveBeenCalled();
  });

  it("accepts a restriction that started earlier and still applies today", async () => {
    expect((await post(base, { ...validBody, startDate: "2026-10-19" })).status).toBe(201);
  });

  it("only restricts catalog trails", async () => {
    trailLookup.mockResolvedValue(null);
    const response = await post(base, validBody);
    expect(response.status).toBe(422);
    expect(response.body.error.details[0].code).toBe("UNSUPPORTED_TRAIL");
  });
});

describe("Coordinator lists and lifts restrictions", () => {
  it("lists restrictions newest first with their status", async () => {
    findRestrictions.mockResolvedValue([
      restriction({ id: "upcoming", startDate: "2026-10-25", endDate: "2026-10-25" }),
      restriction(),
      restriction({ id: "lifted", liftedAt: new Date("2026-10-19T12:00:00Z"), liftedBy: { id: "coordinator-1", fullName: "Office Coordinator" } }),
      restriction({ id: "ended", startDate: "2026-10-01", endDate: "2026-10-02" }),
    ] as never);
    const response = await get(base);
    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { status: string }) => item.status)).toEqual(["UPCOMING", "ACTIVE", "LIFTED", "ENDED"]);
    expect(findRestrictions).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ startDate: "desc" }, { createdAt: "desc" }] }));
  });

  it("lifts a restriction once and records who lifted it", async () => {
    findRestriction.mockResolvedValue(restriction({ liftedAt: new Date(), liftedBy: { id: "coordinator-1", fullName: "Office Coordinator" } }) as never);
    const response = await post(`${base}/restriction-1/lift`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "LIFTED", liftedBy: { fullName: "Office Coordinator" } });
    expect(updateRestrictions).toHaveBeenCalledWith({
      where: { id: "restriction-1", liftedAt: null },
      data: { liftedAt: new Date("2026-10-20T00:30:00Z"), liftedById: "coordinator-1" },
    });
  });

  it("refuses lifting twice and unknown restrictions", async () => {
    updateRestrictions.mockResolvedValue({ count: 0 } as never);
    findRestriction.mockResolvedValueOnce(restriction({ liftedAt: new Date() }) as never);
    const again = await post(`${base}/restriction-1/lift`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("RESTRICTION_ALREADY_LIFTED");
    findRestriction.mockResolvedValueOnce(null);
    const missing = await post(`${base}/missing/lift`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("RESTRICTION_NOT_FOUND");
  });
});

describe("Public trail restrictions", () => {
  it("lists closures from today onwards without coordinator details or a token", async () => {
    findRestrictions.mockResolvedValue([restriction()] as never);
    const response = await request(app).get("/api/v1/trails/trl_sulfatara/restrictions");
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      { id: "restriction-1", startDate: "2026-10-20", endDate: "2026-10-21", reason: "Heavy rain advisory", status: "ACTIVE" },
    ]);
    expect(findRestrictions).toHaveBeenCalledWith(expect.objectContaining({
      where: { trailId: "trl_sulfatara", liftedAt: null, endDate: { gte: "2026-10-20" } },
    }));
  });

  it("returns 404 for a trail outside the catalog", async () => {
    trailLookup.mockResolvedValue(null);
    const response = await request(app).get("/api/v1/trails/trl_unknown/restrictions");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("TRAIL_NOT_FOUND");
  });
});
