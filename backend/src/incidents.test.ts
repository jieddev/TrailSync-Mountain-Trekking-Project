import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    guide: { findUnique: vi.fn() },
    booking: { findUnique: vi.fn() },
    incident: { findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));

import { app } from "./app.js";
import { firebaseAuth } from "./lib/firebase-admin.js";
import { prisma } from "./lib/prisma.js";

const verify = vi.mocked(firebaseAuth.verifyIdToken);
const userLookup = vi.mocked(prisma.user.findUnique);
const findGuide = vi.mocked(prisma.guide.findUnique);
const findBooking = vi.mocked(prisma.booking.findUnique);
const findIncident = vi.mocked(prisma.incident.findFirst);
const findIncidentById = vi.mocked(prisma.incident.findUnique);
const findIncidentOrThrow = vi.mocked(prisma.incident.findUniqueOrThrow);
const listIncidents = vi.mocked(prisma.incident.findMany);
const createIncident = vi.mocked(prisma.incident.create);
const updateIncident = vi.mocked(prisma.incident.update);
const updateIncidents = vi.mocked(prisma.incident.updateMany);

const now = new Date("2026-10-29T02:00:00Z");
const guideUser = { id: "user-juan", fullName: "Juan", role: "GUIDE" };
const coordinator = { id: "coordinator-1", fullName: "Office Coordinator", role: "COORDINATOR" };
const sosPath = "/api/v1/guides/me/hike-requests/booking-1/sos";
const base = "/api/v1/coordinator/incidents";

const incident = (overrides: Record<string, unknown> = {}) => ({
  id: "incident-1", status: "OPEN", latitude: 11.0812, longitude: 124.7301, accuracyM: 12, locationAt: new Date("2026-10-29T01:59:30Z"),
  note: "Hiker twisted an ankle", createdAt: now, acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, resolvedBy: null, resolutionNote: null,
  guide: { id: "g-juan", user: { fullName: "Juan" } },
  booking: {
    id: "booking-1", status: "IN_PROGRESS", scheduledDate: "2026-10-29", scheduledTime: "08:00",
    trail: { id: "trl_sulfatara", name: "Sulfatara" }, owner: { fullName: "Hiker One" }, _count: { participants: 4 },
  },
  ...overrides,
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
  findBooking.mockResolvedValue({ guideId: "g-juan", status: "IN_PROGRESS" } as never);
  findIncident.mockResolvedValue(null);
  createIncident.mockResolvedValue(incident() as never);
  updateIncidents.mockResolvedValue({ count: 1 } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Guide sends an SOS", () => {
  const location = { latitude: 11.0812, longitude: 124.7301, accuracyM: 12, recordedAt: "2026-10-29T01:59:30Z", note: "  Hiker twisted an ankle  " };

  it("is only for guides", async () => {
    userLookup.mockResolvedValueOnce({ ...guideUser, role: "HIKER" } as never);
    expect((await send("post", sosPath, location)).status).toBe(403);
    expect(createIncident).not.toHaveBeenCalled();
  });

  it("raises an incident with the guide's location without changing the booking", async () => {
    const response = await send("post", sosPath, location);
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: "incident-1", status: "OPEN",
      booking: {
        id: "booking-1", status: "IN_PROGRESS", scheduledDate: "2026-10-29", scheduledTime: "08:00",
        trail: { id: "trl_sulfatara", name: "Sulfatara" }, owner: { fullName: "Hiker One" }, participantCount: 4,
      },
      guide: { id: "g-juan", fullName: "Juan" },
      location: { latitude: 11.0812, longitude: 124.7301, accuracyM: 12, recordedAt: "2026-10-29T01:59:30.000Z" },
      note: "Hiker twisted an ankle", createdAt: now.toISOString(),
      acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, resolvedBy: null, resolutionNote: null,
    });
    expect(createIncident).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        bookingId: "booking-1", guideId: "g-juan", note: "Hiker twisted an ankle",
        latitude: 11.0812, longitude: 124.7301, accuracyM: 12, locationAt: new Date("2026-10-29T01:59:30Z"),
      },
    }));
  });

  it("can be sent with no location or note, and from a dispatched trek not yet started", async () => {
    findBooking.mockResolvedValue({ guideId: "g-juan", status: "GUIDE_ASSIGNED" } as never);
    createIncident.mockResolvedValue(incident({ latitude: null, longitude: null, accuracyM: null, locationAt: null, note: null }) as never);
    const response = await send("post", sosPath);
    expect(response.status).toBe(201);
    expect(response.body.location).toBeNull();
    expect(createIncident).toHaveBeenCalledWith(expect.objectContaining({ data: { bookingId: "booking-1", guideId: "g-juan", note: null } }));
  });

  it("uses the server time for a fix stamped in the future", async () => {
    await send("post", sosPath, { latitude: 11, longitude: 124, recordedAt: "2026-10-29T05:00:00Z" });
    expect(createIncident.mock.calls[0][0].data).toMatchObject({ locationAt: now });
  });

  it("validates the location and note", async () => {
    const codes = async (body: object) => (await send("post", sosPath, body)).body.error.details.map((detail: { field: string; code: string }) => `${detail.field}:${detail.code}`);
    expect(await codes({ latitude: 91 })).toEqual(["latitude:INVALID_LOCATION", "longitude:INVALID_LOCATION"]);
    expect(await codes({ latitude: 11, longitude: "124", accuracyM: -1 })).toEqual(["longitude:INVALID_LOCATION", "accuracyM:INVALID_LOCATION"]);
    expect(await codes({ recordedAt: "yesterday", note: "x".repeat(501) })).toEqual(["recordedAt:INVALID_DATE", "note:TOO_LONG"]);
    expect(createIncident).not.toHaveBeenCalled();
  });

  it("returns the unresolved incident on a repeat, with the newer location", async () => {
    findIncident.mockResolvedValue({ id: "incident-1", locationAt: new Date("2026-10-29T01:50:00Z") } as never);
    updateIncident.mockResolvedValue(incident() as never);
    const response = await send("post", sosPath, location);
    expect(response.status).toBe(200);
    expect(createIncident).not.toHaveBeenCalled();
    expect(updateIncident).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "incident-1" },
      data: { latitude: 11.0812, longitude: 124.7301, accuracyM: 12, locationAt: new Date("2026-10-29T01:59:30Z") },
    }));
    expect(findIncident).toHaveBeenCalledWith(expect.objectContaining({ where: { bookingId: "booking-1", status: { not: "RESOLVED" } } }));
  });

  it("keeps the stored location when a repeat has an older one or none", async () => {
    findIncident.mockResolvedValue({ id: "incident-1", locationAt: new Date("2026-10-29T02:00:00Z") } as never);
    findIncidentOrThrow.mockResolvedValue(incident() as never);
    expect((await send("post", sosPath, location)).status).toBe(200);
    expect((await send("post", sosPath)).status).toBe(200);
    expect(updateIncident).not.toHaveBeenCalled();
  });

  it("returns the first incident when two SOS requests race", async () => {
    createIncident.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    findIncident.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "incident-1", locationAt: null } as never);
    updateIncident.mockResolvedValue(incident() as never);
    const response = await send("post", sosPath, location);
    expect(response.status).toBe(200);
    expect(response.body.id).toBe("incident-1");
  });

  it("is refused for another guide's booking or a trek that is not active", async () => {
    findBooking.mockResolvedValueOnce({ guideId: "g-other", status: "IN_PROGRESS" } as never);
    const other = await send("post", sosPath);
    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe("BOOKING_NOT_FOUND");
    for (const status of ["CHECKED_IN", "COMPLETED"]) {
      findBooking.mockResolvedValueOnce({ guideId: "g-juan", status } as never);
      const response = await send("post", sosPath);
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("SOS_NOT_ALLOWED");
    }
    expect(createIncident).not.toHaveBeenCalled();
  });

  it("lets the guide check the latest incident on their booking", async () => {
    findIncident.mockResolvedValue(incident({ status: "ACKNOWLEDGED", acknowledgedAt: now, acknowledgedBy: { id: "coordinator-1", fullName: "Office Coordinator" } }) as never);
    const response = await send("get", sosPath);
    expect(response.status).toBe(200);
    expect(response.body.incident).toMatchObject({ status: "ACKNOWLEDGED", acknowledgedBy: { fullName: "Office Coordinator" } });

    findIncident.mockResolvedValue(null);
    expect((await send("get", sosPath)).body).toEqual({ incident: null });
  });
});

describe("Coordinator handles incidents", () => {
  beforeEach(() => {
    userLookup.mockResolvedValue(coordinator as never);
  });

  it("requires the coordinator role", async () => {
    userLookup.mockResolvedValueOnce(guideUser as never);
    expect((await send("get", base)).status).toBe(403);
    expect(listIncidents).not.toHaveBeenCalled();
  });

  it("lists unresolved incidents first and filters by status", async () => {
    listIncidents.mockResolvedValue([incident()] as never);
    const response = await send("get", base);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(listIncidents).toHaveBeenCalledWith(expect.objectContaining({ where: {}, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }));

    await send("get", `${base}?status=OPEN`);
    expect(listIncidents).toHaveBeenLastCalledWith(expect.objectContaining({ where: { status: "OPEN" } }));
    const invalid = await send("get", `${base}?status=CLOSED`);
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.details[0].code).toBe("INVALID_STATUS");
  });

  it("acknowledges an open incident once", async () => {
    findIncidentById.mockResolvedValue(incident({ status: "ACKNOWLEDGED", acknowledgedAt: now, acknowledgedBy: { id: "coordinator-1", fullName: "Office Coordinator" } }) as never);
    const response = await send("post", `${base}/incident-1/acknowledge`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ACKNOWLEDGED", acknowledgedBy: { fullName: "Office Coordinator" } });
    expect(updateIncidents).toHaveBeenCalledWith({
      where: { id: "incident-1", status: { in: ["OPEN"] } },
      data: { status: "ACKNOWLEDGED", acknowledgedAt: now, acknowledgedById: "coordinator-1" },
    });

    updateIncidents.mockResolvedValue({ count: 0 } as never);
    const again = await send("post", `${base}/incident-1/acknowledge`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("INCIDENT_ALREADY_ACKNOWLEDGED");
  });

  it("resolves an incident with a required note", async () => {
    const missing = await send("post", `${base}/incident-1/resolve`, { note: "  " });
    expect(missing.status).toBe(422);
    expect(missing.body.error.details[0].code).toBe("REQUIRED");
    expect((await send("post", `${base}/incident-1/resolve`, { note: "x".repeat(501) })).body.error.details[0].code).toBe("TOO_LONG");
    expect(updateIncidents).not.toHaveBeenCalled();

    findIncidentById.mockResolvedValue(incident({ status: "RESOLVED", resolvedAt: now, resolutionNote: "Group walked down safely" }) as never);
    const response = await send("post", `${base}/incident-1/resolve`, { note: " Group walked down safely " });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "RESOLVED", resolutionNote: "Group walked down safely" });
    expect(updateIncidents).toHaveBeenCalledWith({
      where: { id: "incident-1", status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      data: { status: "RESOLVED", resolvedAt: now, resolvedById: "coordinator-1", resolutionNote: "Group walked down safely" },
    });
  });

  it("refuses resolving twice and unknown incidents", async () => {
    updateIncidents.mockResolvedValue({ count: 0 } as never);
    findIncidentById.mockResolvedValueOnce(incident({ status: "RESOLVED" }) as never);
    const again = await send("post", `${base}/incident-1/resolve`, { note: "Done" });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("INCIDENT_ALREADY_RESOLVED");

    findIncidentById.mockResolvedValueOnce(null);
    const unknown = await send("post", `${base}/missing/acknowledge`);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("INCIDENT_NOT_FOUND");
  });
});
