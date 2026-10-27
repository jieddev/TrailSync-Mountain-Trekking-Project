import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/certificates.js", () => ({ sendTrekCertificates: vi.fn() }));
vi.mock("./lib/prisma.js", () => ({
  prisma: {
    trailRestriction: { findFirst: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    booking: { findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    bookingParticipant: { updateMany: vi.fn(), createMany: vi.fn() },
    guide: { findFirst: vi.fn(), updateMany: vi.fn() },
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
const findMany = vi.mocked(prisma.booking.findMany);
const findBooking = vi.mocked(prisma.booking.findUnique);
const findBookingOrThrow = vi.mocked(prisma.booking.findUniqueOrThrow);
const updateBookings = vi.mocked(prisma.booking.updateMany);
const updateBooking = vi.mocked(prisma.booking.update);
const updateParticipants = vi.mocked(prisma.bookingParticipant.updateMany);
const createParticipants = vi.mocked(prisma.bookingParticipant.createMany);
const frontGuide = vi.mocked(prisma.guide.findFirst);
const updateGuides = vi.mocked(prisma.guide.updateMany);
const queueLock = vi.mocked(prisma.$executeRaw);
const transaction = vi.mocked(prisma.$transaction);
const coordinator = { id: "coordinator-1", fullName: "Office Coordinator", role: "COORDINATOR" };
const base = "/api/v1/coordinator/bookings";
const roster = { status: "CONFIRMED", scheduledDate: "2026-10-20", participants: [{ id: "p-owner" }, { id: "p-2" }, { id: "p-3" }] };
const booking = (overrides: Record<string, unknown> = {}) => ({
  id: "booking-1", trail: { id: "trl_sulfatara", name: "Sulfatara" }, scheduledDate: "2026-10-20", scheduledTime: "08:00",
  packagePrice: 550, downpaymentAmount: 275, status: "GUIDE_ASSIGNED", downpaymentStatus: "VERIFIED",
  guide: { id: "guide-juan", user: { fullName: "Juan" } }, checkedInAt: new Date("2026-10-20T00:30:00Z"),
  guideAssignedAt: new Date("2026-10-20T00:30:00Z"), completedAt: null,
  createdAt: new Date("2026-10-07T00:00:00Z"), updatedAt: new Date("2026-10-20T00:30:00Z"),
  owner: { id: "owner-1", fullName: "Hiker One", email: "hiker@example.com" },
  participants: [{ id: "p-owner", kind: "BOOKING_OWNER", name: "Hiker One", age: 28, address: "Ormoc", attendance: "PRESENT" }],
  ...overrides,
});
const allPresent = [{ participantId: "p-owner", present: true }, { participantId: "p-2", present: true }, { participantId: "p-3", present: true }];
const walkIn = (name: string) => ({ name, age: 30, address: "Ormoc" });
const post = (path: string, body: object = {}) => request(app).post(path).set("Authorization", "Bearer token").send(body);
const get = (path: string) => request(app).get(path).set("Authorization", "Bearer token");

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.trailRestriction.findMany).mockResolvedValue([] as never);
  // Only Date is faked: 08:30 on 2026-10-20 in Manila.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T00:30:00Z"));
  verify.mockResolvedValue({ uid: "verified-uid" } as never);
  userLookup.mockResolvedValue(coordinator as never);
  transaction.mockImplementation(async (callback: any) => callback(prisma) as never);
  findBooking.mockResolvedValue(roster as never);
  updateBookings.mockResolvedValue({ count: 1 } as never);
  updateGuides.mockResolvedValue({ count: 1 } as never);
  frontGuide.mockResolvedValue({ id: "guide-juan" } as never);
  findBookingOrThrow.mockResolvedValue(booking() as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Coordinator check-in", () => {
  it("requires the coordinator role", async () => {
    expect((await request(app).post(`${base}/booking-1/check-in`).send({ attendance: allPresent })).status).toBe(401);
    for (const role of ["HIKER", "GUIDE"]) {
      userLookup.mockResolvedValueOnce({ ...coordinator, role } as never);
      expect((await post(`${base}/booking-1/check-in`, { attendance: allPresent })).status).toBe(403);
    }
    expect(transaction).not.toHaveBeenCalled();
  });

  it("checks in a full group and assigns the guide at the front of the queue in the same transaction", async () => {
    const response = await post(`${base}/booking-1/check-in`, { attendance: allPresent });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "GUIDE_ASSIGNED", guide: { id: "guide-juan", fullName: "Juan" }, owner: { id: "owner-1" } });
    expect(response.body.participants[0]).toMatchObject({ attendance: "PRESENT" });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(updateBookings).toHaveBeenNthCalledWith(1, {
      where: { id: "booking-1", status: "CONFIRMED", scheduledDate: "2026-10-20" },
      data: { status: "CHECKED_IN", checkedInAt: expect.any(Date) },
    });
    expect(updateParticipants).toHaveBeenCalledWith({ where: { bookingId: "booking-1", id: { in: ["p-owner", "p-2", "p-3"] } }, data: { attendance: "PRESENT" } });
    expect(queueLock).toHaveBeenCalled();
    expect(frontGuide).toHaveBeenCalledWith(expect.objectContaining({ where: { dutyStatus: "AVAILABLE" }, orderBy: [{ availableSince: "asc" }, { id: "asc" }] }));
    expect(updateGuides).toHaveBeenCalledWith({ where: { id: "guide-juan", dutyStatus: "AVAILABLE" }, data: { dutyStatus: "ASSIGNED", availableSince: null } });
    expect(updateBookings).toHaveBeenNthCalledWith(2, {
      where: { id: "booking-1", status: "CHECKED_IN" },
      data: { status: "GUIDE_ASSIGNED", guideId: "guide-juan", guideAssignedAt: expect.any(Date) },
    });
    expect(createParticipants).not.toHaveBeenCalled();
  });

  it("records absentees and walk-ins without changing the price", async () => {
    const response = await post(`${base}/booking-1/check-in`, {
      attendance: [{ participantId: "p-owner", present: true }, { participantId: "p-2", present: false }, { participantId: "p-3", present: true }],
      walkIns: [{ name: "  Walk In  ", age: 22, address: " Ormoc ", email: " Walk@Example.com " }, walkIn("Second")],
      packagePrice: 1,
    });
    expect(response.status).toBe(200);
    expect(updateParticipants).toHaveBeenCalledWith({ where: { bookingId: "booking-1", id: { in: ["p-owner", "p-3"] } }, data: { attendance: "PRESENT" } });
    expect(updateParticipants).toHaveBeenCalledWith({ where: { bookingId: "booking-1", id: { in: ["p-2"] } }, data: { attendance: "ABSENT" } });
    expect(createParticipants).toHaveBeenCalledWith({ data: [
      { bookingId: "booking-1", kind: "WALK_IN", attendance: "PRESENT", name: "Walk In", age: 22, address: "Ormoc", email: "walk@example.com" },
      { bookingId: "booking-1", kind: "WALK_IN", attendance: "PRESENT", name: "Second", age: 30, address: "Ormoc", email: null },
    ] });
    expect(JSON.stringify(updateBookings.mock.calls)).not.toContain("packagePrice");
  });

  it("leaves the group waiting in CHECKED_IN when no guide is available", async () => {
    frontGuide.mockResolvedValue(null);
    findBookingOrThrow.mockResolvedValue(booking({ status: "CHECKED_IN", guide: null, guideAssignedAt: null }) as never);
    const response = await post(`${base}/booking-1/check-in`, { attendance: allPresent });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "CHECKED_IN", guide: null });
    expect(updateGuides).not.toHaveBeenCalled();
    expect(updateBookings).toHaveBeenCalledTimes(1);
  });

  it("only checks in confirmed bookings on their Manila scheduled date", async () => {
    findBooking.mockResolvedValueOnce({ ...roster, status: "PENDING_CONFIRMATION" } as never);
    const pending = await post(`${base}/booking-1/check-in`, { attendance: allPresent });
    expect(pending.status).toBe(409);
    expect(pending.body.error.code).toBe("CHECK_IN_NOT_ALLOWED");
    findBooking.mockResolvedValueOnce({ ...roster, status: "GUIDE_ASSIGNED" } as never);
    expect((await post(`${base}/booking-1/check-in`, { attendance: allPresent })).body.error.code).toBe("CHECK_IN_NOT_ALLOWED");
    findBooking.mockResolvedValueOnce({ ...roster, scheduledDate: "2026-10-21" } as never);
    const tomorrow = await post(`${base}/booking-1/check-in`, { attendance: allPresent });
    expect(tomorrow.status).toBe(409);
    expect(tomorrow.body.error.code).toBe("NOT_SCHEDULED_TODAY");
    findBooking.mockResolvedValueOnce(null);
    expect((await post(`${base}/missing/check-in`, { attendance: allPresent })).status).toBe(404);
    expect(updateBookings).not.toHaveBeenCalled();
  });

  it("uses the Manila date even when it is still yesterday in UTC", async () => {
    vi.setSystemTime(new Date("2026-10-19T16:30:00Z"));
    expect((await post(`${base}/booking-1/check-in`, { attendance: allPresent })).status).toBe(200);
  });

  it("returns 409 when a concurrent check-in already moved the booking", async () => {
    updateBookings.mockResolvedValueOnce({ count: 0 } as never);
    const response = await post(`${base}/booking-1/check-in`, { attendance: allPresent });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CHECK_IN_NOT_ALLOWED");
    expect(frontGuide).not.toHaveBeenCalled();
  });

  it("validates the request shape", async () => {
    const empty = await post(`${base}/booking-1/check-in`, {});
    expect(empty.status).toBe(422);
    expect(empty.body.error.details).toContainEqual(expect.objectContaining({ field: "attendance", code: "REQUIRED" }));
    const malformed = await post(`${base}/booking-1/check-in`, { attendance: [{ participantId: "p-owner", present: "yes" }], walkIns: [{ name: " ", age: 0, email: "not-an-email" }] });
    expect(malformed.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "attendance.0.present", code: "INVALID_TYPE" }),
      expect.objectContaining({ field: "walkIns.0.name", code: "REQUIRED" }),
      expect.objectContaining({ field: "walkIns.0.age", code: "INVALID_AGE" }),
      expect.objectContaining({ field: "walkIns.0.address", code: "REQUIRED" }),
      expect.objectContaining({ field: "walkIns.0.email", code: "INVALID_EMAIL" }),
    ]));
    expect(transaction).not.toHaveBeenCalled();
  });

  it("requires every booked participant marked once, at least one present, and at most five people", async () => {
    const check = async (body: object) => (await post(`${base}/booking-1/check-in`, body)).body.error.details;
    expect(await check({ attendance: [...allPresent, { participantId: "stranger", present: true }] })).toContainEqual(expect.objectContaining({ field: "attendance.3.participantId", code: "UNKNOWN_PARTICIPANT" }));
    expect(await check({ attendance: [...allPresent, { participantId: "p-2", present: false }] })).toContainEqual(expect.objectContaining({ code: "DUPLICATE_PARTICIPANT" }));
    expect(await check({ attendance: allPresent.slice(0, 2) })).toContainEqual(expect.objectContaining({ field: "attendance", code: "MISSING_PARTICIPANT" }));
    expect(await check({ attendance: allPresent.map((mark) => ({ ...mark, present: false })), walkIns: [walkIn("Only Walk-in")] }))
      .toContainEqual(expect.objectContaining({ field: "attendance", code: "AT_LEAST_ONE_PRESENT" }));
    expect(await check({ attendance: allPresent, walkIns: [walkIn("A"), walkIn("B"), walkIn("C")] }))
      .toContainEqual(expect.objectContaining({ field: "walkIns", code: "PARTICIPANT_LIMIT_EXCEEDED" }));
    expect(updateBookings).not.toHaveBeenCalled();
    // Booked 3, two absent: three walk-ins still fit in the package of five.
    const fits = await post(`${base}/booking-1/check-in`, {
      attendance: [{ participantId: "p-owner", present: true }, { participantId: "p-2", present: false }, { participantId: "p-3", present: true }],
      walkIns: [walkIn("A"), walkIn("B"), walkIn("C")],
    });
    expect(fits.status).toBe(200);
  });

  it("hides database failures behind a safe error", async () => {
    findBooking.mockRejectedValue(new Error("connection refused"));
    const response = await post(`${base}/booking-1/check-in`, { attendance: allPresent });
    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({ code: "INTERNAL_SERVER_ERROR", message: "Could not check in the booking." });
  });
});

describe("Assigning a guide to a waiting group", () => {
  it("assigns the guide at the front of the queue", async () => {
    findBooking.mockResolvedValue({ status: "CHECKED_IN" } as never);
    const response = await post(`${base}/booking-1/assign-guide`);
    expect(response.status).toBe(200);
    expect(response.body.guide).toEqual({ id: "guide-juan", fullName: "Juan" });
    expect(updateBookings).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "booking-1", status: "CHECKED_IN" } }));
  });

  it("refuses when the group is not waiting or no guide is available", async () => {
    findBooking.mockResolvedValueOnce({ status: "GUIDE_ASSIGNED" } as never);
    expect((await post(`${base}/booking-1/assign-guide`)).body.error.code).toBe("BOOKING_NOT_WAITING");
    findBooking.mockResolvedValueOnce({ status: "CHECKED_IN" } as never);
    frontGuide.mockResolvedValueOnce(null);
    const noGuide = await post(`${base}/booking-1/assign-guide`);
    expect(noGuide.status).toBe(409);
    expect(noGuide.body.error.code).toBe("NO_GUIDE_AVAILABLE");
    findBooking.mockResolvedValueOnce(null);
    expect((await post(`${base}/missing/assign-guide`)).status).toBe(404);
    expect(updateBookings).not.toHaveBeenCalled();
  });
});

describe("Completing a trek", () => {
  it("completes the trek and returns the guide to the end of the queue", async () => {
    findBooking.mockResolvedValue({ status: "GUIDE_ASSIGNED", guideId: "guide-juan" } as never);
    findBookingOrThrow.mockResolvedValue(booking({ status: "COMPLETED", completedAt: new Date() }) as never);
    const response = await post(`${base}/booking-1/complete`);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("COMPLETED");
    expect(updateBooking).toHaveBeenCalledWith({ where: { id: "booking-1" }, data: { status: "COMPLETED", completedAt: expect.any(Date) } });
    expect(updateGuides).toHaveBeenCalledWith({
      where: { id: "guide-juan", dutyStatus: "ASSIGNED" },
      data: { dutyStatus: "AVAILABLE", availableSince: new Date("2026-10-20T00:30:00Z") },
    });
    expect(sendCertificates).toHaveBeenCalledWith("booking-1", expect.anything());
  });

  it("completes a trek the guide started from the app", async () => {
    findBooking.mockResolvedValue({ status: "IN_PROGRESS", guideId: "guide-juan" } as never);
    findBookingOrThrow.mockResolvedValue(booking({ status: "COMPLETED", completedAt: new Date() }) as never);
    expect((await post(`${base}/booking-1/complete`)).status).toBe(200);
    expect(updateBooking).toHaveBeenCalledWith({ where: { id: "booking-1" }, data: { status: "COMPLETED", completedAt: expect.any(Date) } });
    expect(updateGuides).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "guide-juan", dutyStatus: "ASSIGNED" } }));
  });

  it("refuses groups that are not on a trek, so a retried completion is harmless", async () => {
    findBooking.mockResolvedValueOnce({ status: "COMPLETED", guideId: "guide-juan" } as never);
    const retried = await post(`${base}/booking-1/complete`);
    expect(retried.status).toBe(409);
    expect(retried.body.error.code).toBe("BOOKING_NOT_ON_TREK");
    findBooking.mockResolvedValueOnce(null);
    expect((await post(`${base}/missing/complete`)).status).toBe(404);
    expect(updateGuides).not.toHaveBeenCalled();
    expect(sendCertificates).not.toHaveBeenCalled();
  });
});

describe("Resending certificates", () => {
  it("sends the unsent certificates of a completed trek", async () => {
    findBooking.mockResolvedValue({ status: "COMPLETED" } as never);
    sendCertificates.mockResolvedValue(2);
    findBookingOrThrow.mockResolvedValue(booking({ status: "COMPLETED", completedAt: new Date() }) as never);
    const response = await post(`${base}/booking-1/certificates/resend`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ sent: 2, booking: { id: "booking-1", status: "COMPLETED" } });
  });

  it("refuses a trek that is not completed, and unknown bookings", async () => {
    findBooking.mockResolvedValueOnce({ status: "IN_PROGRESS" } as never);
    const response = await post(`${base}/booking-1/certificates/resend`);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("BOOKING_NOT_COMPLETED");
    findBooking.mockResolvedValueOnce(null);
    expect((await post(`${base}/missing/certificates/resend`)).status).toBe(404);
    expect(sendCertificates).not.toHaveBeenCalled();
  });
});

describe("Coordinator booking list filters", () => {
  it("filters by the new statuses and by today's Manila date", async () => {
    findMany.mockResolvedValue([] as never);
    expect((await get(`${base}?status=CHECKED_IN`)).status).toBe(200);
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { status: "CHECKED_IN" }, orderBy: [{ checkedInAt: "asc" }] }));
    await get(`${base}?status=IN_PROGRESS`);
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { status: "IN_PROGRESS" } }));
    await get(`${base}?status=CONFIRMED&today=true`);
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { status: "CONFIRMED", scheduledDate: "2026-10-20" } }));
    await get(`${base}?scheduledDate=2026-11-01`);
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { scheduledDate: "2026-11-01" } }));
  });

  it("rejects invalid filters", async () => {
    const response = await get(`${base}?scheduledDate=11/01/2026&today=yes`);
    expect(response.status).toBe(422);
    expect(response.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "scheduledDate", code: "INVALID_DATE" }),
      expect.objectContaining({ field: "today", code: "INVALID_VALUE" }),
    ]));
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("Trail restrictions at check-in and dispatch", () => {
  const closure = { startDate: "2026-10-20", endDate: "2026-10-20", reason: "Typhoon signal no. 1" };
  const findRestriction = vi.mocked(prisma.trailRestriction.findFirst);

  it("refuses check-in while the trail is closed today, without dispatching", async () => {
    findBooking.mockResolvedValue({ ...roster, trailId: "trl_sulfatara" } as never);
    findRestriction.mockResolvedValue(closure as never);
    const response = await post(`${base}/booking-1/check-in`, { attendance: allPresent });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("TRAIL_RESTRICTED");
    expect(findRestriction).toHaveBeenCalledWith(expect.objectContaining({
      where: { trailId: "trl_sulfatara", liftedAt: null, startDate: { lte: "2026-10-20" }, endDate: { gte: "2026-10-20" } },
    }));
    expect(updateBookings).not.toHaveBeenCalled();
    expect(updateGuides).not.toHaveBeenCalled();
  });

  it("refuses assigning a guide while the trail is closed today", async () => {
    findBooking.mockResolvedValue({ status: "CHECKED_IN", trailId: "trl_sulfatara" } as never);
    findRestriction.mockResolvedValue(closure as never);
    const response = await post(`${base}/booking-1/assign-guide`);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("TRAIL_RESTRICTED");
    expect(updateBookings).not.toHaveBeenCalled();
  });

  it("shows the restriction on the coordinator's booking list", async () => {
    findMany.mockResolvedValue([booking({ status: "CONFIRMED" })] as never);
    vi.mocked(prisma.trailRestriction.findMany).mockResolvedValue([{ trailId: "trl_sulfatara", ...closure }] as never);
    const response = await get(`${base}?today=true`);
    expect(response.status).toBe(200);
    expect(response.body.items[0].trailRestriction).toEqual(closure);
  });
});
