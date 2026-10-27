import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/certificates.js", () => ({ sendTrekCertificates: vi.fn() }));
vi.mock("./lib/prisma.js", () => ({
  prisma: {
    trailRestriction: { findFirst: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    booking: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    guide: { findUnique: vi.fn(), updateMany: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

import { app } from "./app.js";
import { sendTrekCertificates } from "./lib/certificates.js";
import { firebaseAuth } from "./lib/firebase-admin.js";
import { prisma } from "./lib/prisma.js";

const verify = vi.mocked(firebaseAuth.verifyIdToken);
const sendCertificates = vi.mocked(sendTrekCertificates);
const userLookup = vi.mocked(prisma.user.findUnique);
const findGuide = vi.mocked(prisma.guide.findUnique);
const findBooking = vi.mocked(prisma.booking.findUnique);
const findBookingOrThrow = vi.mocked(prisma.booking.findUniqueOrThrow);
const updateBookings = vi.mocked(prisma.booking.updateMany);
const updateBooking = vi.mocked(prisma.booking.update);
const updateGuides = vi.mocked(prisma.guide.updateMany);
const queueLock = vi.mocked(prisma.$executeRaw);
const transaction = vi.mocked(prisma.$transaction);
const guideUser = { id: "user-juan", fullName: "Juan", role: "GUIDE" };
const now = new Date("2026-10-20T01:00:00Z");
const base = "/api/v1/guides/me/hike-requests";
const booking = (overrides: Record<string, unknown> = {}) => ({
  id: "booking-1", trail: { id: "trl_sulfatara", name: "Sulfatara" }, scheduledDate: "2026-10-20", scheduledTime: "08:00",
  packagePrice: 550, downpaymentAmount: 275, status: "IN_PROGRESS", downpaymentStatus: "VERIFIED",
  guide: { id: "g-juan", user: { fullName: "Juan" } }, checkedInAt: now, guideAssignedAt: now, trekStartedAt: now, completedAt: null,
  createdAt: now, updatedAt: now,
  participants: [{ id: "p-owner", kind: "BOOKING_OWNER", name: "Hiker One", age: 28, address: "Ormoc", attendance: "PRESENT" }],
  ...overrides,
});
const post = (path: string) => request(app).post(path).set("Authorization", "Bearer token").send({});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.trailRestriction.findMany).mockResolvedValue([] as never);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  verify.mockResolvedValue({ uid: "verified-uid" } as never);
  userLookup.mockResolvedValue(guideUser as never);
  transaction.mockImplementation(async (callback: any) => callback(prisma) as never);
  findGuide.mockResolvedValue({ id: "g-juan", dutyStatus: "ASSIGNED", availableSince: null, user: { fullName: "Juan", email: "juan@example.com" }, bookings: [] } as never);
  updateBookings.mockResolvedValue({ count: 1 } as never);
  updateGuides.mockResolvedValue({ count: 1 } as never);
  findBookingOrThrow.mockResolvedValue(booking() as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Guide starts a trek", () => {
  it("is only for guides", async () => {
    userLookup.mockResolvedValueOnce({ ...guideUser, role: "COORDINATOR" } as never);
    expect((await post(`${base}/booking-1/start`)).status).toBe(403);
    expect(updateBookings).not.toHaveBeenCalled();
  });

  it("starts the guide's own assigned trek", async () => {
    findBooking.mockResolvedValue({ guideId: "g-juan", status: "GUIDE_ASSIGNED", trailId: "trl_sulfatara" } as never);
    const response = await post(`${base}/booking-1/start`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "booking-1", status: "IN_PROGRESS", trekStartedAt: now.toISOString() });
    expect(updateBookings).toHaveBeenCalledWith({
      where: { id: "booking-1", guideId: "g-juan", status: "GUIDE_ASSIGNED" },
      data: { status: "IN_PROGRESS", trekStartedAt: now },
    });
    expect(sendCertificates).not.toHaveBeenCalled();
  });

  it("refuses a trek that is already started or completed", async () => {
    updateBookings.mockResolvedValue({ count: 0 } as never);
    findBooking.mockResolvedValue({ guideId: "g-juan" } as never);
    const response = await post(`${base}/booking-1/start`);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("TREK_NOT_STARTABLE");
  });

  it("hides another guide's booking and unknown bookings", async () => {
    updateBookings.mockResolvedValue({ count: 0 } as never);
    findBooking.mockResolvedValueOnce({ guideId: "g-pedro" } as never).mockResolvedValueOnce(null);
    expect((await post(`${base}/booking-1/start`)).body.error.code).toBe("BOOKING_NOT_FOUND");
    const missing = await post(`${base}/missing/start`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("BOOKING_NOT_FOUND");
  });

  it("returns 404 when the guide has no dispatch row", async () => {
    findGuide.mockResolvedValue(null);
    const response = await post(`${base}/booking-1/start`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("GUIDE_NOT_FOUND");
  });
});

describe("Guide completes a trek", () => {
  it("completes the started trek and returns the guide to the end of the queue", async () => {
    findBooking.mockResolvedValue({ status: "IN_PROGRESS", guideId: "g-juan" } as never);
    findBookingOrThrow.mockResolvedValue(booking({ status: "COMPLETED", completedAt: now }) as never);
    const response = await post(`${base}/booking-1/complete`);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("COMPLETED");
    expect(queueLock).toHaveBeenCalled();
    expect(updateBooking).toHaveBeenCalledWith({ where: { id: "booking-1" }, data: { status: "COMPLETED", completedAt: now } });
    expect(updateGuides).toHaveBeenCalledWith({ where: { id: "g-juan", dutyStatus: "ASSIGNED" }, data: { dutyStatus: "AVAILABLE", availableSince: now } });
    expect(sendCertificates).toHaveBeenCalledWith("booking-1", expect.anything());
  });

  it("refuses a trek that was not started, so a retried completion is harmless", async () => {
    for (const status of ["GUIDE_ASSIGNED", "COMPLETED"]) {
      findBooking.mockResolvedValueOnce({ status, guideId: "g-juan" } as never);
      const response = await post(`${base}/booking-1/complete`);
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("TREK_NOT_IN_PROGRESS");
    }
    expect(updateBooking).not.toHaveBeenCalled();
    expect(sendCertificates).not.toHaveBeenCalled();
    expect(updateGuides).not.toHaveBeenCalled();
  });

  it("hides another guide's booking", async () => {
    findBooking.mockResolvedValue({ status: "IN_PROGRESS", guideId: "g-pedro" } as never);
    const response = await post(`${base}/booking-1/complete`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("BOOKING_NOT_FOUND");
    expect(updateBooking).not.toHaveBeenCalled();
  });
});

describe("Trail restrictions on trek start", () => {
  it("refuses to start an assigned trek while the trail is closed today", async () => {
    findBooking.mockResolvedValue({ guideId: "g-juan", status: "GUIDE_ASSIGNED", trailId: "trl_sulfatara" } as never);
    vi.mocked(prisma.trailRestriction.findFirst).mockResolvedValue({ startDate: "2026-10-20", endDate: "2026-10-21", reason: "Landslide on the trail" } as never);
    const response = await post(`${base}/booking-1/start`);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("TRAIL_RESTRICTED");
    expect(prisma.trailRestriction.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { trailId: "trl_sulfatara", liftedAt: null, startDate: { lte: "2026-10-20" }, endDate: { gte: "2026-10-20" } },
    }));
    expect(updateBookings).not.toHaveBeenCalled();
  });
});
