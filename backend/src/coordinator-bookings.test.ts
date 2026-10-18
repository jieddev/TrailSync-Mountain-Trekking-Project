import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    booking: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

import { app } from "./app.js";
import { firebaseAuth } from "./lib/firebase-admin.js";
import { prisma } from "./lib/prisma.js";

const verify = vi.mocked(firebaseAuth.verifyIdToken);
const userLookup = vi.mocked(prisma.user.findUnique);
const findMany = vi.mocked(prisma.booking.findMany);
const findUnique = vi.mocked(prisma.booking.findUnique);
const coordinator = { id: "coordinator-1", fullName: "Office Coordinator", role: "COORDINATOR" };
const booking = (overrides: Record<string, unknown> = {}) => ({
  id: "booking-1", trailId: "trl_sulfatara", trail: { id: "trl_sulfatara", name: "Sulfatara" }, scheduledDate: "2026-11-20", scheduledTime: "08:00",
  packagePrice: 550, downpaymentAmount: 275, status: "PENDING_CONFIRMATION", downpaymentStatus: "PENDING_VERIFICATION",
  createdAt: new Date("2026-10-07T00:00:00Z"), updatedAt: new Date("2026-10-07T00:00:00Z"),
  owner: { id: "owner-1", fullName: "Hiker One", email: "hiker@example.com", firebaseUid: "secret-uid" },
  participants: [{ id: "participant-owner", kind: "BOOKING_OWNER", name: "Hiker One", age: 28, address: "Ormoc" }], ...overrides,
});
const get = (path: string) => request(app).get(path).set("Authorization", "Bearer token");

beforeEach(() => {
  vi.resetAllMocks();
  verify.mockResolvedValue({ uid: "verified-uid" } as never);
  userLookup.mockResolvedValue(coordinator as never);
});

describe("Coordinator bookings", () => {
  it("requires a token, a profile, and the coordinator role", async () => {
    expect((await request(app).get("/api/v1/coordinator/bookings")).status).toBe(401);
    userLookup.mockResolvedValueOnce(null);
    const missingProfile = await get("/api/v1/coordinator/bookings");
    expect(missingProfile.status).toBe(404);
    expect(missingProfile.body.error.code).toBe("PROFILE_NOT_FOUND");
    for (const role of ["HIKER", "GUIDE"]) {
      userLookup.mockResolvedValueOnce({ ...coordinator, role } as never);
      const response = await get("/api/v1/coordinator/bookings?role=COORDINATOR");
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }
    expect(findMany).not.toHaveBeenCalled();
    expect(userLookup).toHaveBeenCalledWith(expect.objectContaining({ where: { firebaseUid: "verified-uid" } }));
  });

  it("lists every booking, soonest trek first, with owner contact details", async () => {
    findMany.mockResolvedValue([booking()] as never);
    const response = await get("/api/v1/coordinator/bookings");
    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
      orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }, { createdAt: "asc" }],
    }));
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      id: "booking-1", trail: { id: "trl_sulfatara", name: "Sulfatara" }, participantCount: 1,
      owner: { id: "owner-1", fullName: "Hiker One", email: "hiker@example.com" },
      paymentRequirement: { downpaymentPercent: 50, amount: 275, currency: "PHP" },
    });
    expect(response.body.items[0].owner).not.toHaveProperty("firebaseUid");
  });

  it("filters by status and rejects unknown statuses", async () => {
    findMany.mockResolvedValue([] as never);
    const pending = await get("/api/v1/coordinator/bookings?status=PENDING_CONFIRMATION");
    expect(pending.status).toBe(200);
    expect(pending.body).toEqual({ items: [] });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "PENDING_CONFIRMATION" } }));
    const invalid = await get("/api/v1/coordinator/bookings?status=CANCELLED");
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.details).toContainEqual(expect.objectContaining({ field: "status", code: "INVALID_STATUS" }));
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("returns any booking by id and 404 for unknown bookings", async () => {
    findUnique.mockResolvedValueOnce(booking({ id: "booking-2" }) as never);
    const found = await get("/api/v1/coordinator/bookings/booking-2");
    expect(found.status).toBe(200);
    expect(found.body).toMatchObject({ id: "booking-2", owner: { email: "hiker@example.com" } });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "booking-2" } }));
    findUnique.mockResolvedValueOnce(null);
    const missing = await get("/api/v1/coordinator/bookings/unknown");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("BOOKING_NOT_FOUND");
  });

  it("hides database failures behind a safe error", async () => {
    findMany.mockRejectedValue(new Error("connection refused at 10.0.0.1"));
    const response = await get("/api/v1/coordinator/bookings");
    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({ code: "INTERNAL_SERVER_ERROR", message: "Could not retrieve bookings." });
  });
});
