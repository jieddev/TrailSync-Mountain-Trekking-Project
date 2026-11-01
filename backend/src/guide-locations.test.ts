import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    guide: { findUnique: vi.fn() },
    booking: { findUnique: vi.fn(), findMany: vi.fn() },
    guideLocation: { createMany: vi.fn() },
  },
}));

import { app } from "./app.js";
import { thinPath } from "./lib/guide-locations.js";
import { firebaseAuth } from "./lib/firebase-admin.js";
import { prisma } from "./lib/prisma.js";

const verify = vi.mocked(firebaseAuth.verifyIdToken);
const userLookup = vi.mocked(prisma.user.findUnique);
const findGuide = vi.mocked(prisma.guide.findUnique);
const findBooking = vi.mocked(prisma.booking.findUnique);
const listBookings = vi.mocked(prisma.booking.findMany);
const createLocations = vi.mocked(prisma.guideLocation.createMany);

const now = new Date("2026-11-01T02:00:00Z");
const startedAt = new Date("2026-11-01T01:00:00Z");
const guideUser = { id: "user-juan", fullName: "Juan", role: "GUIDE" };
const coordinator = { id: "coordinator-1", fullName: "Office Coordinator", role: "COORDINATOR" };
const uploadPath = "/api/v1/guides/me/hike-requests/booking-1/locations";
const livePath = "/api/v1/coordinator/live-treks";

const fix = (overrides: Record<string, unknown> = {}) => ({
  latitude: 11.0812, longitude: 124.7301, accuracyM: 8, recordedAt: "2026-11-01T01:59:30Z", ...overrides,
});
const send = (method: "get" | "post", path: string, body: object = {}) =>
  request(app)[method](path).set("Authorization", "Bearer token").send(body);

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  verify.mockResolvedValue({ uid: "verified-uid" } as never);
  userLookup.mockResolvedValue(guideUser as never);
  findGuide.mockResolvedValue({ id: "g-juan", dutyStatus: "ASSIGNED", availableSince: null, user: { fullName: "Juan", email: "juan@example.com" }, bookings: [] } as never);
  findBooking.mockResolvedValue({ guideId: "g-juan", status: "IN_PROGRESS", trekStartedAt: startedAt } as never);
  createLocations.mockResolvedValue({ count: 1 } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Guide shares their location", () => {
  it("is only for guides", async () => {
    userLookup.mockResolvedValueOnce({ ...guideUser, role: "HIKER" } as never);
    expect((await send("post", uploadPath, { points: [fix()] })).status).toBe(403);
    expect(createLocations).not.toHaveBeenCalled();
  });

  it("stores a batch of fixes for the guide's started trek", async () => {
    const response = await send("post", uploadPath, { points: [fix(), fix({ latitude: 11.082, accuracyM: null, recordedAt: "2026-11-01T01:59:45Z" })] });
    expect(response.status).toBe(202);
    expect(response.body).toEqual({ accepted: 2 });
    expect(createLocations).toHaveBeenCalledWith({
      data: [
        { latitude: 11.0812, longitude: 124.7301, accuracyM: 8, recordedAt: new Date("2026-11-01T01:59:30Z"), bookingId: "booking-1", guideId: "g-juan" },
        { latitude: 11.082, longitude: 124.7301, accuracyM: null, recordedAt: new Date("2026-11-01T01:59:45Z"), bookingId: "booking-1", guideId: "g-juan" },
      ],
    });
  });

  it("uses the server time for a fix stamped in the future", async () => {
    await send("post", uploadPath, { points: [fix({ recordedAt: "2026-11-01T03:00:00Z" })] });
    expect(createLocations).toHaveBeenCalledWith({ data: [expect.objectContaining({ recordedAt: now })] });
  });

  it("drops fixes taken before the trek started", async () => {
    const response = await send("post", uploadPath, { points: [fix({ recordedAt: "2026-11-01T00:30:00Z" })] });
    expect(response.status).toBe(202);
    expect(response.body).toEqual({ accepted: 0 });
    expect(createLocations).not.toHaveBeenCalled();
  });

  it("validates the batch and each fix", async () => {
    expect((await send("post", uploadPath, {})).status).toBe(422);
    expect((await send("post", uploadPath, { points: Array.from({ length: 51 }, () => fix()) })).status).toBe(422);

    const response = await send("post", uploadPath, { points: [fix(), fix({ latitude: 91, accuracyM: -1, recordedAt: "yesterday" })] });
    expect(response.status).toBe(422);
    expect(response.body.error.details.map((detail: { field: string }) => detail.field)).toEqual([
      "points[1].latitude", "points[1].accuracyM", "points[1].recordedAt",
    ]);
    expect(createLocations).not.toHaveBeenCalled();
  });

  it("is refused for another guide's booking or a trek that is not in progress", async () => {
    findBooking.mockResolvedValueOnce({ guideId: "g-other", status: "IN_PROGRESS", trekStartedAt: startedAt } as never);
    expect((await send("post", uploadPath, { points: [fix()] })).status).toBe(404);

    findBooking.mockResolvedValueOnce({ guideId: "g-juan", status: "COMPLETED", trekStartedAt: startedAt } as never);
    const response = await send("post", uploadPath, { points: [fix()] });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("TREK_NOT_IN_PROGRESS");
    expect(createLocations).not.toHaveBeenCalled();
  });
});

describe("Coordinator follows live treks", () => {
  const point = (minute: number) => ({ latitude: 11 + minute / 1000, longitude: 124.73, accuracyM: 5, recordedAt: new Date(startedAt.valueOf() + minute * 60_000) });
  const trek = (overrides: Record<string, unknown> = {}) => ({
    id: "booking-1",
    trekStartedAt: startedAt,
    trail: { id: "trl_sulfatara", slug: "sulfatara", name: "Sulfatara" },
    guide: { id: "g-juan", user: { fullName: "Juan" } },
    _count: { participants: 4 },
    locations: [point(0), point(1)],
    ...overrides,
  });

  beforeEach(() => {
    userLookup.mockResolvedValue(coordinator as never);
  });

  it("requires the coordinator role", async () => {
    userLookup.mockResolvedValueOnce(guideUser as never);
    expect((await send("get", livePath)).status).toBe(403);
    expect(listBookings).not.toHaveBeenCalled();
  });

  it("lists started treks with the latest fix and the path walked", async () => {
    listBookings.mockResolvedValueOnce([trek(), trek({ id: "booking-2", locations: [] })] as never);
    const response = await send("get", livePath);
    expect(response.status).toBe(200);
    expect(listBookings).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "IN_PROGRESS" } }));
    expect(response.body.items).toEqual([
      {
        bookingId: "booking-1",
        trail: { id: "trl_sulfatara", slug: "sulfatara", name: "Sulfatara" },
        guide: { id: "g-juan", fullName: "Juan" },
        trekStartedAt: startedAt.toISOString(),
        participantCount: 4,
        latest: { latitude: 11.001, longitude: 124.73, accuracyM: 5, recordedAt: "2026-11-01T01:01:00.000Z" },
        path: [
          { latitude: 11, longitude: 124.73, recordedAt: "2026-11-01T01:00:00.000Z" },
          { latitude: 11.001, longitude: 124.73, recordedAt: "2026-11-01T01:01:00.000Z" },
        ],
      },
      expect.objectContaining({ bookingId: "booking-2", latest: null, path: [] }),
    ]);
  });
});

describe("thinPath", () => {
  it("keeps short paths as they are", () => {
    const points = [1, 2, 3];
    expect(thinPath(points, 5)).toBe(points);
  });

  it("caps long paths and always ends at the newest point", () => {
    const points = Array.from({ length: 2001 }, (_, index) => index);
    const thinned = thinPath(points, 500);
    expect(thinned.length).toBeLessThanOrEqual(500);
    expect(thinned[0]).toBe(0);
    expect(thinned[thinned.length - 1]).toBe(2000);
    expect(thinPath(Array.from({ length: 12 }, (_, index) => index), 5).at(-1)).toBe(11);
  });
});
