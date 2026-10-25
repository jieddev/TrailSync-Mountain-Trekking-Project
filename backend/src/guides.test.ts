import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    booking: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    guide: { findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

import { app } from "./app.js";
import { firebaseAuth } from "./lib/firebase-admin.js";
import { prisma } from "./lib/prisma.js";

const verify = vi.mocked(firebaseAuth.verifyIdToken);
const userLookup = vi.mocked(prisma.user.findUnique);
const findBookings = vi.mocked(prisma.booking.findMany);
const findOwnBooking = vi.mocked(prisma.booking.findFirst);
const findBooking = vi.mocked(prisma.booking.findUnique);
const findBookingOrThrow = vi.mocked(prisma.booking.findUniqueOrThrow);
const updateBooking = vi.mocked(prisma.booking.update);
const updateGuides = vi.mocked(prisma.guide.updateMany);
const findGuides = vi.mocked(prisma.guide.findMany);
const findGuide = vi.mocked(prisma.guide.findUnique);
const findGuideOrThrow = vi.mocked(prisma.guide.findUniqueOrThrow);
const updateGuide = vi.mocked(prisma.guide.update);
const countGuides = vi.mocked(prisma.guide.count);
const queueLock = vi.mocked(prisma.$executeRaw);
const transaction = vi.mocked(prisma.$transaction);
const coordinator = { id: "coordinator-1", fullName: "Office Coordinator", role: "COORDINATOR" };
const guideUser = { id: "user-juan", fullName: "Juan", role: "GUIDE" };
const since = (minute: number) => new Date(`2026-10-20T00:${String(minute).padStart(2, "0")}:00Z`);
const guide = (id: string, fullName: string, dutyStatus: string, availableSince: Date | null = null, bookings: unknown[] = []) => ({
  id, dutyStatus, availableSince, user: { fullName, email: `${fullName.toLowerCase()}@example.com` }, bookings,
});
const trek = { id: "booking-1", scheduledDate: "2026-10-20", scheduledTime: "08:00", trail: { id: "trl_sulfatara", name: "Sulfatara" } };
const get = (path: string) => request(app).get(path).set("Authorization", "Bearer token");
const post = (path: string, body: object = {}) => request(app).post(path).set("Authorization", "Bearer token").send(body);

beforeEach(() => {
  vi.resetAllMocks();
  verify.mockResolvedValue({ uid: "verified-uid" } as never);
  userLookup.mockResolvedValue(coordinator as never);
  transaction.mockImplementation(async (callback: any) => callback(prisma) as never);
  countGuides.mockResolvedValue(0 as never);
});

describe("Coordinator guide queue", () => {
  it("requires the coordinator role", async () => {
    expect((await request(app).get("/api/v1/coordinator/guides")).status).toBe(401);
    userLookup.mockResolvedValueOnce(guideUser as never);
    expect((await get("/api/v1/coordinator/guides")).status).toBe(403);
    expect(findGuides).not.toHaveBeenCalled();
  });

  it("lists the FIFO queue first, then guides on a trek, then off-duty guides", async () => {
    findGuides.mockResolvedValue([
      guide("g-carlo", "Carlo", "OFF_DUTY"),
      guide("g-pedro", "Pedro", "AVAILABLE", since(1)),
      guide("g-maria", "Maria", "AVAILABLE", since(2)),
      guide("g-juan", "Juan", "ASSIGNED", null, [trek]),
      guide("g-ana", "Ana", "OFF_DUTY"),
    ] as never);
    const response = await get("/api/v1/coordinator/guides");
    expect(response.status).toBe(200);
    expect(findGuides).toHaveBeenCalledWith(expect.objectContaining({ where: { user: { role: "GUIDE" } }, orderBy: [{ availableSince: "asc" }, { id: "asc" }] }));
    expect(response.body.items.map((item: any) => [item.fullName, item.dutyStatus, item.queuePosition])).toEqual([
      ["Pedro", "AVAILABLE", 1], ["Maria", "AVAILABLE", 2], ["Juan", "ASSIGNED", null], ["Ana", "OFF_DUTY", null], ["Carlo", "OFF_DUTY", null],
    ]);
    expect(response.body.items[2].currentBooking).toEqual(trek);
    expect(response.body.items[0]).toMatchObject({ email: "pedro@example.com", currentBooking: null });
  });

  it("puts a guide who reports in at the end of the queue", async () => {
    findGuide.mockResolvedValue({ dutyStatus: "OFF_DUTY" } as never);
    findGuideOrThrow.mockResolvedValue(guide("g-carlo", "Carlo", "AVAILABLE", since(5)) as never);
    countGuides.mockResolvedValue(3 as never);
    const response = await post("/api/v1/coordinator/guides/g-carlo/availability", { status: "AVAILABLE" });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "g-carlo", dutyStatus: "AVAILABLE", queuePosition: 4 });
    expect(queueLock).toHaveBeenCalled();
    expect(updateGuide).toHaveBeenCalledWith({ where: { id: "g-carlo" }, data: { dutyStatus: "AVAILABLE", availableSince: expect.any(Date) } });
  });

  it("marks a guide off duty, and keeps the place of a guide who is already available", async () => {
    findGuide.mockResolvedValueOnce({ dutyStatus: "AVAILABLE" } as never);
    findGuideOrThrow.mockResolvedValue(guide("g-pedro", "Pedro", "OFF_DUTY") as never);
    const offDuty = await post("/api/v1/coordinator/guides/g-pedro/availability", { status: "OFF_DUTY" });
    expect(offDuty.status).toBe(200);
    expect(offDuty.body.queuePosition).toBeNull();
    expect(updateGuide).toHaveBeenCalledWith({ where: { id: "g-pedro" }, data: { dutyStatus: "OFF_DUTY", availableSince: null } });
    updateGuide.mockClear();
    findGuide.mockResolvedValueOnce({ dutyStatus: "AVAILABLE" } as never);
    findGuideOrThrow.mockResolvedValue(guide("g-pedro", "Pedro", "AVAILABLE", since(1)) as never);
    expect((await post("/api/v1/coordinator/guides/g-pedro/availability", { status: "AVAILABLE" })).status).toBe(200);
    expect(updateGuide).not.toHaveBeenCalled();
  });

  it("refuses to change a guide on an assigned trek, unknown guides, and invalid states", async () => {
    findGuide.mockResolvedValueOnce({ dutyStatus: "ASSIGNED" } as never);
    const onTrek = await post("/api/v1/coordinator/guides/g-juan/availability", { status: "OFF_DUTY" });
    expect(onTrek.status).toBe(409);
    expect(onTrek.body.error.code).toBe("GUIDE_ON_TREK");
    findGuide.mockResolvedValueOnce(null);
    expect((await post("/api/v1/coordinator/guides/missing/availability", { status: "OFF_DUTY" })).status).toBe(404);
    const invalid = await post("/api/v1/coordinator/guides/g-juan/availability", { status: "ASSIGNED" });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.details).toContainEqual(expect.objectContaining({ field: "status", code: "INVALID_STATUS" }));
    expect(updateGuide).not.toHaveBeenCalled();
  });
});

describe("Guide self-service", () => {
  beforeEach(() => {
    userLookup.mockResolvedValue(guideUser as never);
  });

  it("is only for guides", async () => {
    userLookup.mockResolvedValueOnce(coordinator as never);
    expect((await get("/api/v1/guides/me")).status).toBe(403);
    userLookup.mockResolvedValueOnce({ ...guideUser, role: "HIKER" } as never);
    expect((await get("/api/v1/guides/me/hike-requests")).status).toBe(403);
  });

  it("shows the guide's own duty status and place in the queue", async () => {
    findGuide.mockResolvedValue(guide("g-juan", "Juan", "AVAILABLE", since(3)) as never);
    countGuides.mockResolvedValue(1 as never);
    const response = await get("/api/v1/guides/me");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "g-juan", fullName: "Juan", dutyStatus: "AVAILABLE", queuePosition: 2 });
    expect(findGuide).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-juan" } }));
  });

  it("lets a guide report in for themselves, never for someone else", async () => {
    findGuide
      .mockResolvedValueOnce(guide("g-juan", "Juan", "OFF_DUTY") as never)
      .mockResolvedValueOnce({ dutyStatus: "OFF_DUTY" } as never);
    findGuideOrThrow.mockResolvedValue(guide("g-juan", "Juan", "AVAILABLE", since(9)) as never);
    const response = await post("/api/v1/guides/me/availability", { status: "AVAILABLE", guideId: "g-pedro" });
    expect(response.status).toBe(200);
    expect(updateGuide).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "g-juan" } }));
  });

  it("shows whether the guide's current trek has started", async () => {
    findGuide.mockResolvedValue(guide("g-juan", "Juan", "ASSIGNED", null, [{ ...trek, status: "IN_PROGRESS" }]) as never);
    const response = await get("/api/v1/guides/me");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ dutyStatus: "ASSIGNED", queuePosition: null, currentBooking: { id: "booking-1", status: "IN_PROGRESS" } });
    expect(findGuide).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ bookings: expect.objectContaining({ where: { status: { in: ["GUIDE_ASSIGNED", "IN_PROGRESS"] } } }) }),
    }));
  });

  it("returns 404 when the guide has no dispatch row", async () => {
    findGuide.mockResolvedValue(null);
    const response = await get("/api/v1/guides/me");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("GUIDE_NOT_FOUND");
  });

  it("lists the bookings dispatched to the guide, active trek first", async () => {
    findBookings.mockResolvedValue([{
      id: "booking-1", trail: { id: "trl_sulfatara", name: "Sulfatara" }, scheduledDate: "2026-10-20", scheduledTime: "08:00",
      packagePrice: 550, downpaymentAmount: 275, status: "GUIDE_ASSIGNED", downpaymentStatus: "VERIFIED",
      guide: { id: "g-juan", user: { fullName: "Juan" } }, checkedInAt: since(0), guideAssignedAt: since(0), completedAt: null,
      createdAt: since(0), updatedAt: since(0),
      participants: [{ id: "p-owner", kind: "BOOKING_OWNER", name: "Hiker One", age: 28, address: "Ormoc", attendance: "PRESENT" }],
    }] as never);
    const response = await get("/api/v1/guides/me/hike-requests");
    expect(response.status).toBe(200);
    expect(findBookings).toHaveBeenCalledWith(expect.objectContaining({
      where: { guide: { userId: "user-juan" } },
      orderBy: [{ status: "asc" }, { scheduledDate: "desc" }, { scheduledTime: "desc" }],
    }));
    expect(response.body.items[0]).toMatchObject({
      id: "booking-1", status: "GUIDE_ASSIGNED", trail: { name: "Sulfatara" }, guide: { id: "g-juan", fullName: "Juan" },
      participants: [{ kind: "BOOKING_OWNER", age: 28, attendance: "PRESENT" }],
    });
  });

  describe("completing their own trek", () => {
    const completed = {
      id: "booking-1", trail: { id: "trl_sulfatara", name: "Sulfatara" }, scheduledDate: "2026-10-20", scheduledTime: "08:00",
      packagePrice: 550, downpaymentAmount: 275, status: "COMPLETED", downpaymentStatus: "VERIFIED",
      guide: { id: "g-juan", user: { fullName: "Juan" } }, checkedInAt: since(0), guideAssignedAt: since(0), completedAt: since(5),
      createdAt: since(0), updatedAt: since(5), participants: [],
    };

    beforeEach(() => {
      findGuide.mockResolvedValue(guide("g-juan", "Juan", "ASSIGNED", null, [trek]) as never);
    });

    it("completes the trek and puts the guide back in the queue", async () => {
      findOwnBooking.mockResolvedValue({ id: "booking-1" } as never);
      findBooking.mockResolvedValue({ status: "GUIDE_ASSIGNED", guideId: "g-juan" } as never);
      updateGuides.mockResolvedValue({ count: 1 } as never);
      findBookingOrThrow.mockResolvedValue(completed as never);
      const response = await post("/api/v1/guides/me/hike-requests/booking-1/complete");
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id: "booking-1", status: "COMPLETED" });
      expect(findOwnBooking).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "booking-1", guideId: "g-juan" } }));
      expect(updateBooking).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }));
      expect(updateGuides).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "g-juan", dutyStatus: "ASSIGNED" }, data: expect.objectContaining({ dutyStatus: "AVAILABLE" }),
      }));
    });

    it("treats another guide's booking as not found", async () => {
      findOwnBooking.mockResolvedValue(null);
      const response = await post("/api/v1/guides/me/hike-requests/booking-9/complete");
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("BOOKING_NOT_FOUND");
      expect(updateBooking).not.toHaveBeenCalled();
    });

    it("refuses a trek that is not in progress", async () => {
      findOwnBooking.mockResolvedValue({ id: "booking-1" } as never);
      findBooking.mockResolvedValue({ status: "COMPLETED", guideId: "g-juan" } as never);
      const response = await post("/api/v1/guides/me/hike-requests/booking-1/complete");
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("BOOKING_NOT_ON_TREK");
      expect(updateBooking).not.toHaveBeenCalled();
    });

    it("is only for guides", async () => {
      userLookup.mockResolvedValueOnce(coordinator as never);
      expect((await post("/api/v1/guides/me/hike-requests/booking-1/complete")).status).toBe(403);
      expect(findOwnBooking).not.toHaveBeenCalled();
    });
  });
});
