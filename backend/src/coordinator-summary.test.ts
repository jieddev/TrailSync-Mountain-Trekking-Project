import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    booking: { groupBy: vi.fn(), count: vi.fn() },
    guide: { groupBy: vi.fn(), findFirst: vi.fn() },
    guideApplication: { count: vi.fn() },
    incident: { count: vi.fn() },
    trailRestriction: { count: vi.fn() },
  },
}));

import { app } from "./app.js";
import { firebaseAuth } from "./lib/firebase-admin.js";
import { prisma } from "./lib/prisma.js";

const verify = vi.mocked(firebaseAuth.verifyIdToken);
const userLookup = vi.mocked(prisma.user.findUnique);
const bookingGroups = vi.mocked(prisma.booking.groupBy);
const bookingCount = vi.mocked(prisma.booking.count);
const guideGroups = vi.mocked(prisma.guide.groupBy);
const frontGuide = vi.mocked(prisma.guide.findFirst);
const applicationCount = vi.mocked(prisma.guideApplication.count);
const incidentCount = vi.mocked(prisma.incident.count);
const restrictionCount = vi.mocked(prisma.trailRestriction.count);
const coordinator = { id: "coordinator-1", fullName: "Office Coordinator", role: "COORDINATOR" };
const path = "/api/v1/coordinator/summary";
const get = () => request(app).get(path).set("Authorization", "Bearer token");
const group = (status: string, downpaymentStatus: string, count: number) => ({ status, downpaymentStatus, _count: { _all: count } });

beforeEach(() => {
  vi.resetAllMocks();
  // 08:30 on 2026-10-20 in Manila.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T00:30:00Z"));
  verify.mockResolvedValue({ uid: "verified-uid" } as never);
  userLookup.mockResolvedValue(coordinator as never);
  bookingGroups.mockResolvedValue([] as never);
  bookingCount.mockResolvedValue(0 as never);
  guideGroups.mockResolvedValue([] as never);
  frontGuide.mockResolvedValue(null as never);
  applicationCount.mockResolvedValue(0 as never);
  incidentCount.mockResolvedValue(0 as never);
  restrictionCount.mockResolvedValue(0 as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Coordinator summary", () => {
  it("requires the coordinator role", async () => {
    expect((await request(app).get(path)).status).toBe(401);
    for (const role of ["HIKER", "GUIDE"]) {
      userLookup.mockResolvedValueOnce({ ...coordinator, role } as never);
      expect((await get()).status).toBe(403);
    }
  });

  it("returns zero counts when nothing is happening", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      bookings: { needsReview: 0, waitingOnHiker: 0, upcoming: 0, arrivingToday: 0, completed: 0 },
      dispatch: { waitingForGuide: 0, onTrail: 0 },
      guides: { available: 0, onTrek: 0, nextUp: null },
      guideApplications: { pending: 0 },
      incidents: { open: 0 },
      trailRestrictions: { active: 0 },
    });
  });

  it("splits bookings by what the coordinator does next", async () => {
    bookingGroups.mockResolvedValue([
      group("PENDING_CONFIRMATION", "PENDING_VERIFICATION", 2),
      // A reschedule keeps its verified payment and still needs confirming.
      group("PENDING_CONFIRMATION", "VERIFIED", 1),
      group("PENDING_CONFIRMATION", "REJECTED", 4),
      group("CONFIRMED", "VERIFIED", 6),
      group("CHECKED_IN", "VERIFIED", 1),
      group("GUIDE_ASSIGNED", "VERIFIED", 2),
      group("IN_PROGRESS", "VERIFIED", 3),
      group("COMPLETED", "VERIFIED", 9),
    ] as never);
    bookingCount.mockResolvedValue(2 as never);

    const response = await get();

    expect(response.body.bookings).toEqual({ needsReview: 3, waitingOnHiker: 4, upcoming: 6, arrivingToday: 2, completed: 9 });
    expect(response.body.dispatch).toEqual({ waitingForGuide: 1, onTrail: 5 });
    expect(bookingCount).toHaveBeenCalledWith({ where: { status: "CONFIRMED", scheduledDate: "2026-10-20" } });
  });

  it("reports the guide queue and the next guide up", async () => {
    guideGroups.mockResolvedValue([
      { dutyStatus: "AVAILABLE", _count: { _all: 3 } },
      { dutyStatus: "ASSIGNED", _count: { _all: 2 } },
      { dutyStatus: "OFF_DUTY", _count: { _all: 5 } },
    ] as never);
    frontGuide.mockResolvedValue({ id: "guide-juan", user: { fullName: "Juan" } } as never);

    const response = await get();

    expect(response.body.guides).toEqual({ available: 3, onTrek: 2, nextUp: { id: "guide-juan", fullName: "Juan" } });
    expect(frontGuide).toHaveBeenCalledWith(expect.objectContaining({
      where: { dutyStatus: "AVAILABLE", user: { role: "GUIDE" } },
      orderBy: [{ availableSince: "asc" }, { id: "asc" }],
    }));
  });

  it("counts pending guide requests, open SOS alerts, and restrictions in force today", async () => {
    applicationCount.mockResolvedValue(1 as never);
    incidentCount.mockResolvedValue(2 as never);
    restrictionCount.mockResolvedValue(1 as never);

    const response = await get();

    expect(response.body.guideApplications).toEqual({ pending: 1 });
    expect(response.body.incidents).toEqual({ open: 2 });
    expect(response.body.trailRestrictions).toEqual({ active: 1 });
    expect(applicationCount).toHaveBeenCalledWith({ where: { status: "PENDING" } });
    expect(incidentCount).toHaveBeenCalledWith({ where: { status: "OPEN" } });
    expect(restrictionCount).toHaveBeenCalledWith({
      where: { liftedAt: null, startDate: { lte: "2026-10-20" }, endDate: { gte: "2026-10-20" } },
    });
  });

  it("answers 500 when a count fails", async () => {
    incidentCount.mockRejectedValue(new Error("db down"));
    const response = await get();
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
