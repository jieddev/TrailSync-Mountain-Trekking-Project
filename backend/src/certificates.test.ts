import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/prisma.js", () => ({
  prisma: {
    booking: { findUnique: vi.fn() },
    bookingParticipant: { updateMany: vi.fn() },
  },
}));
vi.mock("./lib/mailer.js", () => ({ sendCertificateEmail: vi.fn() }));

import { renderCertificatePdf } from "./lib/certificate-pdf.js";
import { sendTrekCertificates } from "./lib/certificates.js";
import { sendCertificateEmail } from "./lib/mailer.js";
import { prisma } from "./lib/prisma.js";

const findBooking = vi.mocked(prisma.booking.findUnique);
const updateParticipants = vi.mocked(prisma.bookingParticipant.updateMany);
const send = vi.mocked(sendCertificateEmail);
const log = { info: vi.fn(), error: vi.fn() } as never;
const completed = (participants: { id: string; name: string; email: string | null }[]) => ({
  status: "COMPLETED", completedAt: new Date("2026-10-26T03:00:00Z"), trail: { name: "Sulfatara" },
  owner: { email: "owner@example.com" }, guide: { user: { fullName: "Juan Dela Cruz" } }, participants,
});

beforeEach(() => {
  vi.resetAllMocks();
  updateParticipants.mockResolvedValue({ count: 1 } as never);
});

describe("Emailing trek certificates", () => {
  it("emails each present hiker, and the owner for hikers without an email", async () => {
    findBooking.mockResolvedValue(completed([
      { id: "p-owner", name: "Owner", email: "owner@example.com" },
      { id: "p-2", name: "Maria", email: "maria@example.com" },
      { id: "p-3", name: "Kid", email: null },
    ]) as never);
    expect(await sendTrekCertificates("booking-1", log)).toBe(3);
    expect(send.mock.calls.map(([to, name]) => [to, name])).toEqual([
      ["owner@example.com", "Owner"], ["maria@example.com", "Maria"], ["owner@example.com", "Kid"],
    ]);
    expect(send).toHaveBeenCalledWith("maria@example.com", "Maria", "Sulfatara", expect.any(Uint8Array));
    // Only unsent, non-absent hikers are loaded.
    expect((findBooking.mock.calls[0]![0] as any).select.participants).toMatchObject({
      where: { certificateSentAt: null, OR: [{ attendance: null }, { attendance: "PRESENT" }] },
    });
    expect(updateParticipants).toHaveBeenCalledWith({ where: { id: "p-2", certificateSentAt: null }, data: { certificateSentAt: expect.any(Date) } });
  });

  it("sends nothing for a trek that is not completed", async () => {
    findBooking.mockResolvedValue({ ...completed([{ id: "p-2", name: "Maria", email: "maria@example.com" }]), status: "IN_PROGRESS" } as never);
    expect(await sendTrekCertificates("booking-1", log)).toBe(0);
    findBooking.mockResolvedValue(null);
    expect(await sendTrekCertificates("missing", log)).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("skips a certificate another send already claimed", async () => {
    findBooking.mockResolvedValue(completed([{ id: "p-2", name: "Maria", email: "maria@example.com" }]) as never);
    updateParticipants.mockResolvedValue({ count: 0 } as never);
    expect(await sendTrekCertificates("booking-1", log)).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps going after a failed send and unclaims it for a resend", async () => {
    findBooking.mockResolvedValue(completed([
      { id: "p-2", name: "Maria", email: "bad@example.com" },
      { id: "p-3", name: "Pedro", email: "pedro@example.com" },
    ]) as never);
    send.mockRejectedValueOnce(new Error("SMTP down"));
    expect(await sendTrekCertificates("booking-1", log)).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(updateParticipants).toHaveBeenCalledWith({ where: { id: "p-2" }, data: { certificateSentAt: null } });
  });

  it("never throws", async () => {
    findBooking.mockRejectedValue(new Error("database down"));
    await expect(sendTrekCertificates("booking-1", log)).resolves.toBe(0);
  });
});

describe("Certificate PDF", () => {
  it("is one A4 landscape page, even for a very long name", async () => {
    const pdf = await renderCertificatePdf({
      recipient: "Maria Clara de los Santos y Rizal Mercado Alonso Realonda", trailName: "Mt. Malingatong",
      date: new Date("2026-10-26T03:00:00Z"), guideName: "Juan Dela Cruz",
    });
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([842, 595]);
  });
});
