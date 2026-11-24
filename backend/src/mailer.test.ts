import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseMailFrom, sendCertificateEmail, sendVerificationCodeEmail } from "./lib/mailer.js";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.stubEnv("BREVO_API_KEY", "test-key");
  vi.stubEnv("MAIL_FROM", "TrailSync <sender@example.com>");
  vi.stubEnv("SMTP_USER", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const sentBody = () => JSON.parse(fetchMock.mock.calls[0]![1].body as string);

describe("Sending email through Brevo", () => {
  it("posts the verification code from the configured sender", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 201 }));
    await sendVerificationCodeEmail("hiker@example.com", "123456");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.headers["api-key"]).toBe("test-key");
    expect(sentBody()).toMatchObject({
      sender: { name: "TrailSync", email: "sender@example.com" },
      to: [{ email: "hiker@example.com" }],
      subject: "Your TrailSync verification code: 123456",
    });
    expect(sentBody().attachment).toBeUndefined();
  });

  it("attaches the certificate PDF as base64", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 201 }));
    await sendCertificateEmail("hiker@example.com", "Ana Cruz", "Sulfatara", new Uint8Array([37, 80, 68, 70]));

    expect(sentBody().attachment).toEqual([{ name: "TrailSync-Certificate-Ana-Cruz.pdf", content: Buffer.from("%PDF").toString("base64") }]);
  });

  it("fails when Brevo refuses the email, so callers can report it", async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"sender not verified"}', { status: 400 }));
    await expect(sendVerificationCodeEmail("hiker@example.com", "123456")).rejects.toThrow(/Brevo answered 400/);
  });

  it("only logs when no mail service is configured", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    await sendVerificationCodeEmail("hiker@example.com", "123456");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("parseMailFrom", () => {
  it.each([
    ["TrailSync <a@b.com>", { name: "TrailSync", email: "a@b.com" }],
    ['"Trail Sync" <a@b.com>', { name: "Trail Sync", email: "a@b.com" }],
    ["<a@b.com>", { email: "a@b.com" }],
    ["a@b.com", { email: "a@b.com" }],
  ])("reads %s", (from, expected) => {
    expect(parseMailFrom(from)).toEqual(expected);
  });
});
