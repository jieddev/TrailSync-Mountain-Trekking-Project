import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    emailVerification: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("./lib/mailer.js", () => ({ sendVerificationCodeEmail: vi.fn() }));

import { app } from "./app.js";
import { hashCode } from "./lib/email-verification.js";
import { sendVerificationCodeEmail } from "./lib/mailer.js";
import { prisma } from "./lib/prisma.js";

const findUser = vi.mocked(prisma.user.findUnique);
const findVerification = vi.mocked(prisma.emailVerification.findUnique);
const upsert = vi.mocked(prisma.emailVerification.upsert);
const update = vi.mocked(prisma.emailVerification.update);
const send = vi.mocked(sendVerificationCodeEmail);

const pending = (overrides: Record<string, unknown> = {}) => ({
  email: "hiker@example.com",
  codeHash: hashCode("123456"),
  expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  attempts: 0,
  lastSentAt: new Date(Date.now() - 2 * 60 * 1000),
  verifiedAt: null,
  ...overrides,
});

beforeEach(() => vi.resetAllMocks());

describe("POST /api/v1/email-verifications", () => {
  it("emails a 6-digit code and stores only its hash", async () => {
    const response = await request(app).post("/api/v1/email-verifications").send({ email: " Hiker@Example.com " });

    expect(response.status).toBe(201);
    expect(send).toHaveBeenCalledWith("hiker@example.com", expect.stringMatching(/^\d{6}$/));
    const code = send.mock.calls[0]![1];
    const saved = upsert.mock.calls[0]![0];
    expect(saved.where).toEqual({ email: "hiker@example.com" });
    expect(saved.create).toMatchObject({ email: "hiker@example.com", codeHash: hashCode(code), attempts: 0, verifiedAt: null });
    expect(JSON.stringify(saved)).not.toContain(`"${code}"`);
    expect(JSON.stringify(response.body)).not.toContain(code);
  });

  it("replaces an earlier code once the resend wait has passed", async () => {
    findVerification.mockResolvedValue(pending({ attempts: 5 }) as never);

    const response = await request(app).post("/api/v1/email-verifications").send({ email: "hiker@example.com" });

    expect(response.status).toBe(201);
    expect(upsert.mock.calls[0]![0].update).toMatchObject({ attempts: 0, verifiedAt: null });
  });

  it("rejects an invalid email", async () => {
    const response = await request(app).post("/api/v1/email-verifications").send({ email: "not-an-email" });

    expect(response.status).toBe(422);
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses an email that already has an account", async () => {
    findUser.mockResolvedValue({ id: "user-1" } as never);

    const response = await request(app).post("/api/v1/email-verifications").send({ email: "hiker@example.com" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ACCOUNT_EXISTS");
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses to resend within the wait", async () => {
    findVerification.mockResolvedValue(pending({ lastSentAt: new Date(Date.now() - 10 * 1000) }) as never);

    const response = await request(app).post("/api/v1/email-verifications").send({ email: "hiker@example.com" });

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe("RESEND_TOO_SOON");
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("does not expose a mail failure", async () => {
    send.mockRejectedValue(new Error("SMTP password wrong"));

    const response = await request(app).post("/api/v1/email-verifications").send({ email: "hiker@example.com" });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("SMTP");
  });
});

describe("POST /api/v1/email-verifications/verify", () => {
  const verify = (code: string, email = "Hiker@Example.com") =>
    request(app).post("/api/v1/email-verifications/verify").send({ email, code });

  it("marks the email verified for the correct code", async () => {
    findVerification.mockResolvedValue(pending() as never);

    const response = await verify("123456");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ email: "hiker@example.com", verified: true });
    expect(update).toHaveBeenCalledWith({ where: { email: "hiker@example.com" }, data: { verifiedAt: expect.any(Date) } });
  });

  it("counts a wrong code and says how many tries are left", async () => {
    findVerification.mockResolvedValue(pending() as never);
    update.mockResolvedValue({ attempts: 1 } as never);

    const response = await verify("654321");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: "CODE_INCORRECT", message: expect.stringContaining("4 tries left") });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { attempts: { increment: 1 } } }));
  });

  it("locks the code on the fifth wrong try", async () => {
    findVerification.mockResolvedValue(pending({ attempts: 4 }) as never);
    update.mockResolvedValue({ attempts: 5 } as never);

    const response = await verify("654321");

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe("TOO_MANY_ATTEMPTS");
  });

  it("refuses even the correct code after too many wrong tries", async () => {
    findVerification.mockResolvedValue(pending({ attempts: 5 }) as never);

    const response = await verify("123456");

    expect(response.status).toBe(429);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses an expired code", async () => {
    findVerification.mockResolvedValue(pending({ expiresAt: new Date(Date.now() - 1000) }) as never);

    const response = await verify("123456");

    expect(response.status).toBe(410);
    expect(response.body.error.code).toBe("CODE_EXPIRED");
  });

  it("asks for a code first when none was requested", async () => {
    findVerification.mockResolvedValue(null);

    const response = await verify("123456");

    expect(response.status).toBe(404);
  });

  it.each(["12345", "1234567", "abcdef", ""])("rejects the malformed code %j", async (code) => {
    const response = await verify(code);

    expect(response.status).toBe(422);
    expect(findVerification).not.toHaveBeenCalled();
  });
});
