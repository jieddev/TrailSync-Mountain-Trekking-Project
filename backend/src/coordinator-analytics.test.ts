import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    trail: { findMany: vi.fn() },
    guide: { findMany: vi.fn() },
    booking: { findMany: vi.fn(), groupBy: vi.fn() },
    incident: { findMany: vi.fn() },
    trailRestriction: { findMany: vi.fn() },
  },
}));

import { app } from "./app.js";
import { buildAnalytics, monthsIn, parseRange } from "./lib/analytics.js";
import { firebaseAuth } from "./lib/firebase-admin.js";
import { prisma } from "./lib/prisma.js";

const verify = vi.mocked(firebaseAuth.verifyIdToken);
const userLookup = vi.mocked(prisma.user.findUnique);
const trails = vi.mocked(prisma.trail.findMany);
const guides = vi.mocked(prisma.guide.findMany);
const bookings = vi.mocked(prisma.booking.findMany);
const statusGroups = vi.mocked(prisma.booking.groupBy);
const incidents = vi.mocked(prisma.incident.findMany);
const restrictions = vi.mocked(prisma.trailRestriction.findMany);
const coordinator = { id: "coordinator-1", fullName: "Office Coordinator", role: "COORDINATOR" };
const path = "/api/v1/coordinator/analytics";
const get = (query = "") => request(app).get(`${path}${query}`).set("Authorization", "Bearer token");

const sulfatara = { id: "trl_sulfatara", name: "Sulfatara", isActive: true };
const malingatong = { id: "trl_mt_malingatong", name: "Mt. Malingatong", isActive: true };
const janagdan = { id: "trl_lake_janagdan", name: "Lake Janagdan", isActive: false };
const owner = { kind: "BOOKING_OWNER", attendance: "PRESENT" };
const extra = (attendance: string | null) => ({ kind: "ADDITIONAL_PARTICIPANT", attendance });
const walkIn = { kind: "WALK_IN", attendance: "PRESENT" };

beforeEach(() => {
  vi.resetAllMocks();
  // 08:30 on 2026-10-20 in Manila.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T00:30:00Z"));
  verify.mockResolvedValue({ uid: "verified-uid" } as never);
  userLookup.mockResolvedValue(coordinator as never);
  trails.mockResolvedValue([sulfatara, malingatong, janagdan] as never);
  guides.mockResolvedValue([] as never);
  bookings.mockResolvedValue([] as never);
  statusGroups.mockResolvedValue([] as never);
  incidents.mockResolvedValue([] as never);
  restrictions.mockResolvedValue([] as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Coordinator analytics route", () => {
  it("requires the coordinator role", async () => {
    expect((await request(app).get(path)).status).toBe(401);
    for (const role of ["HIKER", "GUIDE"]) {
      userLookup.mockResolvedValueOnce({ ...coordinator, role } as never);
      expect((await get()).status).toBe(403);
    }
  });

  it("defaults to the last six months and filters by scheduled date", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(response.body.range).toEqual({ from: "2026-05-01", to: "2026-10-20" });
    expect(response.body.months).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(bookings).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "COMPLETED", scheduledDate: { gte: "2026-05-01", lte: "2026-10-20" } },
    }));
    // Incidents use Manila midnight to Manila midnight.
    expect(incidents).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdAt: { gte: new Date("2026-04-30T16:00:00Z"), lt: new Date("2026-10-20T16:00:00Z") } },
    }));
  });

  it("returns zeros and hides retired trails when there is no data", async () => {
    const response = await get("?from=2026-10-01&to=2026-10-31");

    expect(response.body.trails.map((t: { id: string }) => t.id)).toEqual(["trl_sulfatara", "trl_mt_malingatong"]);
    expect(response.body.visitors).toEqual({
      total: 0,
      walkIns: 0,
      byMonth: [{ month: "2026-10", byTrail: { trl_sulfatara: 0, trl_mt_malingatong: 0 } }],
    });
    expect(response.body.safety).toMatchObject({ incidents: 0, medianMinutesToAcknowledge: null, medianMinutesToResolve: null });
    expect(response.body.bookedValue).toEqual({ testMode: true, total: 0, byMonth: [{ month: "2026-10", amount: 0 }] });
  });

  it.each([
    ["?from=2026-13-01", "from"],
    ["?from=2026-02-30&to=2026-03-01", "from"],
    ["?from=2026-10-10&to=2026-10-01", "from"],
    ["?from=2025-01-01&to=2026-10-01", "to"],
    ["?to=yesterday", "to"],
  ])("rejects %s", async (query, field) => {
    const response = await get(query);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details[0].field).toBe(field);
    expect(bookings).not.toHaveBeenCalled();
  });

  it("answers 500 when a query fails", async () => {
    incidents.mockRejectedValue(new Error("db down"));
    const response = await get();
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("buildAnalytics", () => {
  const range = { from: "2026-09-01", to: "2026-10-31" };
  const base = {
    range,
    trails: [sulfatara, malingatong, janagdan],
    guides: [{ id: "g-juan", fullName: "Juan" }, { id: "g-pedro", fullName: "Pedro" }, { id: "g-maria", fullName: "Maria" }],
    completedTreks: [],
    bookingsByStatus: [],
    incidents: [],
    restrictions: [],
  };

  it("counts visitors who went, including walk-ins, and skips absentees", () => {
    const result = buildAnalytics({
      ...base,
      completedTreks: [
        { scheduledDate: "2026-09-05", packagePrice: 550, trailId: "trl_sulfatara", guideId: "g-juan", participants: [owner, extra("ABSENT"), walkIn] },
        { scheduledDate: "2026-10-02", packagePrice: 680, trailId: "trl_mt_malingatong", guideId: "g-juan", participants: [owner, extra(null), extra("PRESENT")] },
        { scheduledDate: "2026-10-09", packagePrice: 550, trailId: "trl_sulfatara", guideId: "g-pedro", participants: [owner] },
      ],
    });

    expect(result.completedTreks).toBe(3);
    expect(result.visitors).toEqual({
      total: 6,
      walkIns: 1,
      byMonth: [
        { month: "2026-09", byTrail: { trl_sulfatara: 2, trl_mt_malingatong: 0 } },
        { month: "2026-10", byTrail: { trl_sulfatara: 1, trl_mt_malingatong: 3 } },
      ],
    });
    expect(result.trails).toEqual([
      { id: "trl_sulfatara", name: "Sulfatara", completedTreks: 2, visitors: 3, averageGroupSize: 1.5 },
      { id: "trl_mt_malingatong", name: "Mt. Malingatong", completedTreks: 1, visitors: 3, averageGroupSize: 3 },
    ]);
    // Guides with no treks are still listed, most treks first.
    expect(result.guides).toEqual([
      { id: "g-juan", fullName: "Juan", completedTreks: 2 },
      { id: "g-pedro", fullName: "Pedro", completedTreks: 1 },
      { id: "g-maria", fullName: "Maria", completedTreks: 0 },
    ]);
    expect(result.bookedValue).toEqual({
      testMode: true,
      total: 1780,
      byMonth: [{ month: "2026-09", amount: 550 }, { month: "2026-10", amount: 1230 }],
    });
  });

  it("reports median response times and unresolved incidents", () => {
    const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1, 0, minutes));
    const result = buildAnalytics({
      ...base,
      incidents: [
        { status: "RESOLVED", createdAt: at(0), acknowledgedAt: at(2), resolvedAt: at(30) },
        { status: "RESOLVED", createdAt: at(0), acknowledgedAt: at(4), resolvedAt: at(90) },
        { status: "ACKNOWLEDGED", createdAt: at(0), acknowledgedAt: at(60), resolvedAt: null },
        { status: "OPEN", createdAt: at(0), acknowledgedAt: null, resolvedAt: null },
      ],
    });

    expect(result.safety).toMatchObject({ incidents: 4, openIncidents: 2, medianMinutesToAcknowledge: 4, medianMinutesToResolve: 60 });
  });

  it("counts closure days inside the range and stops at the day a closure was lifted", () => {
    const result = buildAnalytics({
      ...base,
      restrictions: [
        // Starts before the range: only Sep 1–3 count.
        { trailId: "trl_sulfatara", startDate: "2026-08-25", endDate: "2026-09-03", liftedAt: null },
        // Lifted on Oct 12 (Manila): Oct 10–11 count.
        { trailId: "trl_sulfatara", startDate: "2026-10-10", endDate: "2026-10-20", liftedAt: new Date("2026-10-12T01:00:00Z") },
        // Lifted before it began.
        { trailId: "trl_mt_malingatong", startDate: "2026-10-15", endDate: "2026-10-16", liftedAt: new Date("2026-10-01T00:00:00Z") },
        // A retired trail with a closure is shown.
        { trailId: "trl_lake_janagdan", startDate: "2026-10-30", endDate: "2026-11-05", liftedAt: null },
      ],
    });

    expect(result.safety.closureDaysByTrail).toEqual([
      { trailId: "trl_sulfatara", name: "Sulfatara", days: 5 },
      { trailId: "trl_mt_malingatong", name: "Mt. Malingatong", days: 0 },
      { trailId: "trl_lake_janagdan", name: "Lake Janagdan", days: 2 },
    ]);
  });

  it("maps status groups to counts", () => {
    const result = buildAnalytics({ ...base, bookingsByStatus: [{ status: "COMPLETED", count: 4 }, { status: "CONFIRMED", count: 2 }] });
    expect(result.bookingsByStatus).toEqual({ COMPLETED: 4, CONFIRMED: 2 });
  });
});

describe("range helpers", () => {
  it("lists months across a year boundary", () => {
    expect(monthsIn({ from: "2025-11-15", to: "2026-02-01" })).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("fills a missing end with today", () => {
    expect(parseRange({ from: "2026-10-01" }, new Date("2026-10-20T00:30:00Z"))).toEqual({ from: "2026-10-01", to: "2026-10-20" });
  });
});
