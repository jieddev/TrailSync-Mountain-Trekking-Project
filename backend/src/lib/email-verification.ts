import { createHash, randomInt, timingSafeEqual } from "node:crypto";

// Rules for the one-time code a new hiker enters before their account is created.
export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;
// How long a verified email may be used to create the account.
export const VERIFIED_WINDOW_MS = 30 * 60 * 1000;

export const generateCode = () => randomInt(0, 1_000_000).toString().padStart(6, "0");

export const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

export function codesMatch(code: string, storedHash: string) {
  const given = Buffer.from(hashCode(code), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return given.length === stored.length && timingSafeEqual(given, stored);
}

export const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const looksLikeEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isCode = (value: unknown): value is string =>
  typeof value === "string" && /^\d{6}$/.test(value);
