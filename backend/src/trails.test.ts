import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/prisma.js", () => ({
  prisma: { trail: { findMany: vi.fn(), findFirst: vi.fn() } },
}));

import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";

const lakeJanagdan = { id: "trl_lake_janagdan", slug: "lake-janagdan", name: "Lake Janagdan", description: null, packagePrice: 800 };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Trail catalog", () => {
  it("lists active trails with their package and downpayment", async () => {
    vi.mocked(prisma.trail.findMany).mockResolvedValue([lakeJanagdan] as never);
    const response = await request(app).get("/api/v1/trails");
    expect(response.status).toBe(200);
    expect(prisma.trail.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
    expect(response.body).toEqual({ items: [{
      id: "trl_lake_janagdan", slug: "lake-janagdan", name: "Lake Janagdan", description: null,
      package: { price: { amount: 800, currency: "PHP" }, maximumParticipants: 5, guideCount: 1 },
      paymentRequirement: { downpaymentPercent: 50, amount: 400, currency: "PHP" },
    }] });
  });

  it("retrieves one active trail and hides unknown or inactive ones", async () => {
    vi.mocked(prisma.trail.findFirst).mockResolvedValueOnce(lakeJanagdan as never);
    const found = await request(app).get("/api/v1/trails/trl_lake_janagdan");
    expect(found.status).toBe(200);
    expect(found.body).toMatchObject({ id: "trl_lake_janagdan", paymentRequirement: { amount: 400 } });
    expect(prisma.trail.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "trl_lake_janagdan", isActive: true } }));

    vi.mocked(prisma.trail.findFirst).mockResolvedValueOnce(null);
    const missing = await request(app).get("/api/v1/trails/unknown");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("TRAIL_NOT_FOUND");
  });
});
