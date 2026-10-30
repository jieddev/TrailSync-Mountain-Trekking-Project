import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/prisma.js", () => ({
  prisma: {
    trailRestriction: { findFirst: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    trail: { findFirst: vi.fn() },
    booking: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { app } from "./app.js";
import { CURRENT_WAIVER_VERSION } from "./lib/agreements.js";
import { firebaseAuth } from "./lib/firebase-admin.js";
import { prisma } from "./lib/prisma.js";

const verify = vi.mocked(firebaseAuth.verifyIdToken);
const userLookup = vi.mocked(prisma.user.findUnique);
const trailLookup = vi.mocked(prisma.trail.findFirst);
const tx = {
  trailRestriction: { findFirst: vi.mocked(prisma.trailRestriction.findFirst) },
  booking: {
    create: vi.mocked(prisma.booking.create),
    findFirst: vi.mocked(prisma.booking.findFirst),
    findUnique: vi.mocked(prisma.booking.findUnique),
    updateMany: vi.mocked(prisma.booking.updateMany),
  },
};
const transaction = vi.mocked(prisma.$transaction);
const owner = { id: "owner-1", fullName: "Hiker One", email: "hiker@example.com", role: "HIKER" };
const booking = (overrides: Record<string, unknown> = {}) => ({
  id: "booking-1", trailId: "trl_sulfatara", trail: { id: "trl_sulfatara", name: "Sulfatara" }, scheduledDate: "2026-11-20", scheduledTime: "08:00",
  packagePrice: 550, downpaymentAmount: 275, status: "PENDING_CONFIRMATION", downpaymentStatus: "PENDING_VERIFICATION",
  createdAt: new Date("2026-10-07T00:00:00Z"), updatedAt: new Date("2026-10-07T00:00:00Z"),
  participants: [{ id: "participant-owner", kind: "BOOKING_OWNER", name: "Hiker One", age: 28, address: "Ormoc" }], ...overrides,
});
const createBody = (additionalParticipants: unknown[] = []) => ({ trailId: "trl_sulfatara", scheduledDate: "2026-11-20", scheduledTime: "08:00", ownerDetails: { age: 28, address: "Ormoc City" }, additionalParticipants, acceptedWaiverVersion: CURRENT_WAIVER_VERSION });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.trailRestriction.findMany).mockResolvedValue([] as never);
  verify.mockResolvedValue({ uid: "verified-uid" } as never);
  userLookup.mockResolvedValue(owner as never);
  trailLookup.mockResolvedValue({ id: "trl_sulfatara", packagePrice: 550 } as never);
  transaction.mockImplementation(async (callback: any) => callback(tx) as never);
});

describe("Booking Foundation", () => {
  it("creates a booking with authenticated ownership and authoritative values", async () => {
    tx.booking.create.mockResolvedValue(booking() as never);
    const response = await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token").send({
      ...createBody(), ownerId: "attacker", userId: "attacker", firebaseUid: "attacker", role: "COORDINATOR", price: 1,
      status: "CONFIRMED", downpaymentStatus: "VERIFIED", guideId: "guide-1", trail: "other trail", participantCount: 99,
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ status: "PENDING_CONFIRMATION", downpaymentStatus: "PENDING_VERIFICATION", trail: { id: "trl_sulfatara", name: "Sulfatara" }, participantCount: 1,
      package: { price: { amount: 550, currency: "PHP" } }, paymentRequirement: { downpaymentPercent: 50, amount: 275, currency: "PHP" },
      participants: [{ kind: "BOOKING_OWNER", name: "Hiker One" }] });
    expect(tx.booking.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: "owner-1", trailId: "trl_sulfatara", packagePrice: 550, downpaymentAmount: 275, status: "PENDING_CONFIRMATION", downpaymentStatus: "PENDING_VERIFICATION" }) }));
  });

  it("accepts four additional participants and rejects a fifth", async () => {
    const people = Array.from({ length: 4 }, (_, index) => ({ name: `Person ${index}`, age: 20, address: "Ormoc" }));
    tx.booking.create.mockResolvedValue(booking({ participants: [...booking().participants, ...people.map((person, i) => ({ id: `p${i}`, kind: "ADDITIONAL_PARTICIPANT", ...person }))] }) as never);
    expect((await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token").send(createBody(people))).status).toBe(201);
    const response = await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token").send(createBody([...people, people[0]]));
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(tx.booking.create).toHaveBeenCalledTimes(1);
  });

  it("stores participant emails for certificates, with the owner's from their profile", async () => {
    tx.booking.create.mockResolvedValue(booking() as never);
    const response = await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token")
      .send(createBody([{ name: "Two", age: 20, address: "Ormoc", email: " Two@Example.com " }, { name: "Three", age: 21, address: "Ormoc", email: "" }]));
    expect(response.status).toBe(201);
    expect((tx.booking.create.mock.calls[0]![0] as any).data.participants.create).toEqual([
      expect.objectContaining({ kind: "BOOKING_OWNER", email: "hiker@example.com" }),
      expect.objectContaining({ name: "Two", email: "two@example.com" }),
      expect.objectContaining({ name: "Three", email: null }),
    ]);
  });

  it("rejects an invalid participant email", async () => {
    const response = await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token")
      .send(createBody([{ name: "Two", age: 20, address: "Ormoc", email: "two@" }]));
    expect(response.status).toBe(422);
    expect(response.body.error.details).toContainEqual(expect.objectContaining({ field: "additionalParticipants.0.email", code: "INVALID_EMAIL" }));
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it("validates schedule and all owner/participant fields", async () => {
    const response = await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token").send({
      scheduledDate: "2026-02-30", scheduledTime: "25:90", ownerDetails: { age: 0, address: " " }, additionalParticipants: [{ name: " ", age: "4", address: "" }],
    });
    expect(response.status).toBe(422);
    expect(response.body.error.details.length).toBeGreaterThanOrEqual(7);
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it("requires a trail selection", async () => {
    const { trailId: _omitted, ...body } = createBody();
    const response = await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token").send(body);
    expect(response.status).toBe(422);
    expect(response.body.error.details).toContainEqual(expect.objectContaining({ field: "trailId", code: "REQUIRED" }));
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it("requires the booking owner to be 18 or older", async () => {
    const minor = await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token").send({ ...createBody(), ownerDetails: { age: 17, address: "Ormoc City" } });
    expect(minor.status).toBe(422);
    expect(minor.body.error.details).toContainEqual(expect.objectContaining({ field: "ownerDetails.age", code: "OWNER_UNDERAGE" }));
    expect(tx.booking.create).not.toHaveBeenCalled();

    tx.booking.create.mockResolvedValue(booking() as never);
    const adult = await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token").send({ ...createBody(), ownerDetails: { age: 18, address: "Ormoc City" } });
    expect(adult.status).toBe(201);
  });

  it("still lets the owner bring participants under 18", async () => {
    tx.booking.create.mockResolvedValue(booking() as never);
    const response = await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token").send(createBody([{ name: "Child", age: 10, address: "Ormoc" }]));
    expect(response.status).toBe(201);
  });

  it("records the trek waiver the owner accepted for the group", async () => {
    tx.booking.create.mockResolvedValue(booking() as never);
    const response = await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token").send(createBody());
    expect(response.status).toBe(201);
    expect(tx.booking.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ waiverAcceptedAt: expect.any(Date), waiverVersion: CURRENT_WAIVER_VERSION }) }));
  });

  it.each([["missing", undefined], ["outdated", "2000-01-01"]])("requires the current trek waiver, rejecting one that is %s", async (_label, acceptedWaiverVersion) => {
    const response = await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token").send({ ...createBody(), acceptedWaiverVersion });
    expect(response.status).toBe(422);
    expect(response.body.error.details).toContainEqual(expect.objectContaining({ field: "acceptedWaiverVersion", code: "WAIVER_NOT_ACCEPTED" }));
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it("rejects trails outside the active catalog", async () => {
    trailLookup.mockResolvedValue(null);
    const response = await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token").send({ ...createBody(), trailId: "unknown-trail" });
    expect(response.status).toBe(422);
    expect(response.body.error.details).toContainEqual(expect.objectContaining({ field: "trailId", code: "UNSUPPORTED_TRAIL" }));
    expect(trailLookup).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "unknown-trail", isActive: true } }));
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it("snapshots the selected trail's price and downpayment", async () => {
    trailLookup.mockResolvedValue({ id: "trl_other", packagePrice: 1200 } as never);
    tx.booking.create.mockResolvedValue(booking({ trailId: "trl_other", trail: { id: "trl_other", name: "Other Trail" }, packagePrice: 1200, downpaymentAmount: 600 }) as never);
    const response = await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token").send({ ...createBody(), trailId: "trl_other", price: 1 });
    expect(response.status).toBe(201);
    expect(tx.booking.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ trailId: "trl_other", packagePrice: 1200, downpaymentAmount: 600 }) }));
    expect(response.body).toMatchObject({ trail: { id: "trl_other", name: "Other Trail" }, package: { price: { amount: 1200 } }, paymentRequirement: { amount: 600 } });
  });

  it("lists and retrieves only bookings owned by the verified profile", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([booking()] as never);
    const list = await request(app).get("/api/v1/bookings?ownerId=other").set("Authorization", "Bearer token");
    expect(list.status).toBe(200);
    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: "owner-1" } }));
    vi.mocked(prisma.booking.findFirst).mockResolvedValue(null);
    const detail = await request(app).get("/api/v1/bookings/other-booking").set("Authorization", "Bearer token");
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe("BOOKING_NOT_FOUND");
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "other-booking", ownerId: "owner-1" } }));
    vi.mocked(prisma.booking.findFirst).mockResolvedValue(booking() as never);
    const owned = await request(app).get("/api/v1/bookings/booking-1").set("Authorization", "Bearer token");
    expect(owned.status).toBe(200);
    expect(owned.body.id).toBe("booking-1");
  });

  it("reschedules an owned confirmed booking in place, retaining verified credit", async () => {
    tx.booking.updateMany.mockResolvedValue({ count: 1 } as never);
    tx.booking.findFirst.mockResolvedValue(booking({ status: "PENDING_CONFIRMATION", downpaymentStatus: "VERIFIED", scheduledDate: "2026-11-21" }) as never);
    const response = await request(app).post("/api/v1/bookings/booking-1/reschedule").set("Authorization", "Bearer token").send({ scheduledDate: "2026-11-21", scheduledTime: "09:00", trailId: "trl_other", packagePrice: 1 });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "booking-1", status: "PENDING_CONFIRMATION", downpaymentStatus: "VERIFIED", trail: { id: "trl_sulfatara" }, paymentRequirement: { amount: 275 } });
    expect(tx.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "booking-1", ownerId: "owner-1", status: "CONFIRMED" },
      data: { scheduledDate: "2026-11-21", scheduledTime: "09:00", status: "PENDING_CONFIRMATION" } }));
  });

  it("does not allow rescheduling another owner's booking", async () => {
    tx.booking.updateMany.mockResolvedValue({ count: 0 } as never);
    tx.booking.findFirst.mockResolvedValue(null);
    const response = await request(app).post("/api/v1/bookings/other/reschedule").set("Authorization", "Bearer token").send({ scheduledDate: "2026-11-21", scheduledTime: "09:00" });
    expect(response.status).toBe(404);
  });

  it("requires coordinator role regardless of client role fields and confirms pending bookings", async () => {
    const hikerAttempt = await request(app).post("/api/v1/bookings/booking-1/confirm").set("Authorization", "Bearer token").send({ role: "COORDINATOR" });
    expect(hikerAttempt.status).toBe(403);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    userLookup.mockResolvedValueOnce({ ...owner, role: "COORDINATOR" } as never);
    tx.booking.updateMany.mockResolvedValue({ count: 1 } as never);
    tx.booking.findUnique.mockResolvedValue(booking({ status: "CONFIRMED", downpaymentStatus: "VERIFIED" }) as never);
    const response = await request(app).post("/api/v1/bookings/booking-1/confirm").set("Authorization", "Bearer token").send({ role: "HIKER", amount: 1, verified: false });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "CONFIRMED", downpaymentStatus: "VERIFIED" });
    expect(tx.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CONFIRMED", downpaymentStatus: "VERIFIED" } }));
  });

  it("reports missing profiles, missing tokens, and nonconfirmable bookings safely", async () => {
    const missingAuth = await request(app).get("/api/v1/bookings");
    expect(missingAuth.status).toBe(401);
    verify.mockRejectedValueOnce(new Error("invalid Firebase token"));
    const invalidAuth = await request(app).get("/api/v1/bookings").set("Authorization", "Bearer invalid");
    expect(invalidAuth.status).toBe(401);
    userLookup.mockResolvedValueOnce(null);
    const missingProfile = await request(app).get("/api/v1/bookings").set("Authorization", "Bearer token");
    expect(missingProfile.status).toBe(404);
    expect(missingProfile.body.error.code).toBe("PROFILE_NOT_FOUND");
    userLookup.mockResolvedValueOnce({ ...owner, role: "COORDINATOR" } as never);
    tx.booking.updateMany.mockResolvedValue({ count: 0 } as never);
    tx.booking.findUnique.mockResolvedValue({ id: "booking-1" } as never);
    const response = await request(app).post("/api/v1/bookings/booking-1/confirm").set("Authorization", "Bearer token");
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("BOOKING_NOT_CONFIRMABLE");
  });
});

describe("Trail restrictions on hiker bookings", () => {
  const closure = { startDate: "2026-11-20", endDate: "2026-11-21", reason: "Heavy rain advisory" };

  it("refuses a booking on a trail closed that date", async () => {
    tx.trailRestriction.findFirst.mockResolvedValue(closure as never);
    const response = await request(app).post("/api/v1/bookings").set("Authorization", "Bearer token").send(createBody());
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("TRAIL_RESTRICTED");
    expect(tx.trailRestriction.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { trailId: "trl_sulfatara", liftedAt: null, startDate: { lte: "2026-11-20" }, endDate: { gte: "2026-11-20" } },
    }));
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it("refuses rescheduling onto a closed date and leaves the booking unchanged", async () => {
    tx.booking.findFirst.mockResolvedValue({ trailId: "trl_sulfatara" } as never);
    tx.trailRestriction.findFirst.mockResolvedValue(closure as never);
    const response = await request(app).post("/api/v1/bookings/booking-1/reschedule").set("Authorization", "Bearer token").send({ scheduledDate: "2026-11-21", scheduledTime: "09:00" });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("TRAIL_RESTRICTED");
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });

  it("shows the restriction on an existing booking for that date, and null otherwise", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([booking(), booking({ id: "booking-2", scheduledDate: "2026-12-01" })] as never);
    vi.mocked(prisma.trailRestriction.findMany).mockResolvedValue([{ trailId: "trl_sulfatara", ...closure }] as never);
    const response = await request(app).get("/api/v1/bookings").set("Authorization", "Bearer token");
    expect(response.status).toBe(200);
    expect(response.body.items[0].trailRestriction).toEqual(closure);
    expect(response.body.items[1].trailRestriction).toBeNull();
  });
});
