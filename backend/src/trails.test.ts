import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/prisma.js", () => ({
  prisma: { trail: { findMany: vi.fn(), findFirst: vi.fn() } },
}));

import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";

const sulfatara = { id: "trl_sulfatara", slug: "sulfatara", name: "Sulfatara", description: null, packagePrice: 550, garbageFee: 20, environmentalFee: 30, entranceFeePerPerson: 50 };
const mtMalingatong = { id: "trl_mt_malingatong", slug: "mt-malingatong", name: "Mt. Malingatong", description: null, packagePrice: 680, garbageFee: 20, environmentalFee: 30, entranceFeePerPerson: 50 };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Trail catalog", () => {
  it("lists active trails, each with its own package price and downpayment", async () => {
    vi.mocked(prisma.trail.findMany).mockResolvedValue([mtMalingatong, sulfatara] as never);
    const response = await request(app).get("/api/v1/trails");
    expect(response.status).toBe(200);
    expect(prisma.trail.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
    expect(response.body).toEqual({ items: [{
      id: "trl_mt_malingatong", slug: "mt-malingatong", name: "Mt. Malingatong", description: null,
      package: { price: { amount: 680, currency: "PHP" }, maximumParticipants: 5, guideCount: 1 },
      fees: { garbage: 20, environmental: 30, entrancePerPerson: 50 },
      paymentRequirement: { downpaymentPercent: 50, amount: 390, currency: "PHP", fullAmount: 780, method: { provider: "GCASH", accountName: "TrailSync Tourism Office (TEST)", accountNumber: "0917 000 0000", qrImagePath: "/payments/gcash-qr-sample.png", testMode: true } },
    }, {
      id: "trl_sulfatara", slug: "sulfatara", name: "Sulfatara", description: null,
      package: { price: { amount: 550, currency: "PHP" }, maximumParticipants: 5, guideCount: 1 },
      fees: { garbage: 20, environmental: 30, entrancePerPerson: 50 },
      paymentRequirement: { downpaymentPercent: 50, amount: 325, currency: "PHP", fullAmount: 650, method: { provider: "GCASH", accountName: "TrailSync Tourism Office (TEST)", accountNumber: "0917 000 0000", qrImagePath: "/payments/gcash-qr-sample.png", testMode: true } },
    }] });
  });

  it("retrieves one active trail and hides unknown or inactive ones", async () => {
    vi.mocked(prisma.trail.findFirst).mockResolvedValueOnce(sulfatara as never);
    const found = await request(app).get("/api/v1/trails/trl_sulfatara");
    expect(found.status).toBe(200);
    expect(found.body).toMatchObject({ id: "trl_sulfatara", paymentRequirement: { amount: 325 } });
    expect(prisma.trail.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "trl_sulfatara", isActive: true } }));

    vi.mocked(prisma.trail.findFirst).mockResolvedValueOnce(null);
    const missing = await request(app).get("/api/v1/trails/unknown");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("TRAIL_NOT_FOUND");
  });
});
