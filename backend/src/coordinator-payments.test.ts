import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/prisma.js", () => ({
  prisma: {
    trailRestriction: { findFirst: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    booking: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
    paymentReceipt: { findFirst: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { app } from "./app.js";
import { firebaseAuth } from "./lib/firebase-admin.js";
import { prisma } from "./lib/prisma.js";

const uploadDir = mkdtempSync(path.join(tmpdir(), "trailsync-receipts-"));
process.env.UPLOAD_DIR = uploadDir;
afterAll(() => rmSync(uploadDir, { recursive: true, force: true }));

const verify = vi.mocked(firebaseAuth.verifyIdToken);
const userLookup = vi.mocked(prisma.user.findUnique);
const findBooking = vi.mocked(prisma.booking.findUnique);
const findBookingOrThrow = vi.mocked(prisma.booking.findUniqueOrThrow);
const updateBookings = vi.mocked(prisma.booking.updateMany);
const findReceipt = vi.mocked(prisma.paymentReceipt.findFirst);
const updateReceipts = vi.mocked(prisma.paymentReceipt.updateMany);
const coordinator = { id: "coordinator-1", fullName: "Office Coordinator", role: "COORDINATOR" };
const base = "/api/v1/coordinator/bookings";
const pending = { status: "PENDING_CONFIRMATION", downpaymentStatus: "PENDING_VERIFICATION", paymentReceipts: [{ id: "receipt-1", status: "SUBMITTED" }] };
const booking = (overrides: Record<string, unknown> = {}) => ({
  id: "booking-1", trail: { id: "trl_sulfatara", name: "Sulfatara" }, scheduledDate: "2026-11-20", scheduledTime: "08:00",
  packagePrice: 550, downpaymentAmount: 275, paymentOption: "DOWNPAYMENT", status: "PENDING_CONFIRMATION", downpaymentStatus: "REJECTED",
  createdAt: new Date("2026-10-07T00:00:00Z"), updatedAt: new Date("2026-10-07T00:00:00Z"),
  owner: { id: "owner-1", fullName: "Hiker One", email: "hiker@example.com" }, participants: [],
  paymentReceipts: [{ id: "receipt-1", amount: 275, status: "REJECTED", rejectionReason: "Amount does not match", createdAt: new Date() }],
  ...overrides,
});
const reject = (body: object) => request(app).post(`${base}/booking-1/payment/reject`).set("Authorization", "Bearer token").send(body);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.trailRestriction.findMany).mockResolvedValue([] as never);
  verify.mockResolvedValue({ uid: "verified-uid" } as never);
  userLookup.mockResolvedValue(coordinator as never);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma) as never);
});

describe("Rejecting a payment receipt", () => {
  it("is coordinator-only", async () => {
    userLookup.mockResolvedValueOnce({ ...coordinator, role: "HIKER" } as never);
    expect((await reject({ reason: "Blurry" })).status).toBe(403);
    expect(updateBookings).not.toHaveBeenCalled();
  });

  it("rejects the receipt awaiting review with the coordinator's reason, keeping the booking pending", async () => {
    findBooking.mockResolvedValue(pending as never);
    updateBookings.mockResolvedValue({ count: 1 } as never);
    updateReceipts.mockResolvedValue({ count: 1 } as never);
    findBookingOrThrow.mockResolvedValue(booking() as never);
    const response = await reject({ reason: "  Amount does not match  " });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "PENDING_CONFIRMATION", downpaymentStatus: "REJECTED", payment: { receipts: [{ status: "REJECTED", rejectionReason: "Amount does not match" }] } });
    expect(updateBookings).toHaveBeenCalledWith({
      where: { id: "booking-1", status: "PENDING_CONFIRMATION", downpaymentStatus: "PENDING_VERIFICATION" },
      data: { downpaymentStatus: "REJECTED" },
    });
    expect(updateReceipts).toHaveBeenCalledWith({
      where: { id: "receipt-1", status: "SUBMITTED" },
      data: { status: "REJECTED", rejectionReason: "Amount does not match", reviewedAt: expect.any(Date), reviewedById: "coordinator-1" },
    });
  });

  it.each([[{}, "REQUIRED"], [{ reason: "   " }, "REQUIRED"], [{ reason: "x".repeat(501) }, "TOO_LONG"]])("requires a short reason (%#)", async (body, code) => {
    const response = await reject(body);
    expect(response.status).toBe(422);
    expect(response.body.error.details).toContainEqual(expect.objectContaining({ field: "reason", code }));
  });

  it.each([
    ["already confirmed", { ...pending, status: "CONFIRMED", downpaymentStatus: "VERIFIED" }],
    ["already rejected", { ...pending, downpaymentStatus: "REJECTED", paymentReceipts: [{ id: "receipt-1", status: "REJECTED" }] }],
    ["without a receipt", { ...pending, paymentReceipts: [] }],
  ])("refuses a booking %s", async (_label, state) => {
    findBooking.mockResolvedValue(state as never);
    const response = await reject({ reason: "Blurry" });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("PAYMENT_NOT_REJECTABLE");
    expect(updateBookings).not.toHaveBeenCalled();
  });

  it("reports a missing booking", async () => {
    findBooking.mockResolvedValue(null);
    expect((await reject({ reason: "Blurry" })).status).toBe(404);
  });
});

describe("Viewing a receipt image", () => {
  it("sends the screenshot stored in the database to coordinators", async () => {
    findReceipt.mockResolvedValue({ storedFileName: "db.png", mimeType: "image/png", file: { data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) } } as never);
    const response = await request(app).get(`${base}/booking-1/payment-receipts/receipt-1/file`).set("Authorization", "Bearer token");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("image/png");
    expect(response.headers["content-length"]).toBe("4");
    expect(findReceipt).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ file: { select: { data: true } } }) }));
  });

  it("still streams a screenshot saved on disk before images moved into the database", async () => {
    mkdirSync(path.join(uploadDir, "receipts"), { recursive: true });
    writeFileSync(path.join(uploadDir, "receipts", "abc.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    findReceipt.mockResolvedValue({ storedFileName: "abc.png", mimeType: "image/png" } as never);
    const response = await request(app).get(`${base}/booking-1/payment-receipts/receipt-1/file`).set("Authorization", "Bearer token");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("image/png");
    expect(findReceipt).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "receipt-1", bookingId: "booking-1" } }));
  });

  it("answers 404 for an unknown receipt or a missing file", async () => {
    findReceipt.mockResolvedValue(null);
    expect((await request(app).get(`${base}/booking-1/payment-receipts/nope/file`).set("Authorization", "Bearer token")).status).toBe(404);
    findReceipt.mockResolvedValue({ storedFileName: "gone.png", mimeType: "image/png" } as never);
    const missing = await request(app).get(`${base}/booking-1/payment-receipts/receipt-1/file`).set("Authorization", "Bearer token");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("RECEIPT_FILE_MISSING");
  });

  it("is hidden from hikers on the coordinator route", async () => {
    userLookup.mockResolvedValueOnce({ ...coordinator, role: "HIKER" } as never);
    expect((await request(app).get(`${base}/booking-1/payment-receipts/receipt-1/file`).set("Authorization", "Bearer token")).status).toBe(403);
    expect(findReceipt).not.toHaveBeenCalled();
  });
});
