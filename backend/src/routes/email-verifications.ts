import { Router } from "express";

import {
  CODE_TTL_MS,
  codesMatch,
  generateCode,
  hashCode,
  isCode,
  looksLikeEmail,
  MAX_ATTEMPTS,
  normalizeEmail,
  RESEND_COOLDOWN_MS,
} from "../lib/email-verification.js";
import { fail } from "../lib/http-errors.js";
import { sendVerificationCodeEmail } from "../lib/mailer.js";
import { prisma } from "../lib/prisma.js";
import { asObject } from "../lib/validation.js";

// Used by web sign-up before the Firebase account exists, so these routes
// take no token. POST /users later checks that the email was verified here.
export const emailVerificationsRouter = Router();

const invalidEmail = (response: Parameters<typeof fail>[0]) =>
  fail(response, 422, "VALIDATION_ERROR", "Enter a valid email address.", [
    { field: "email", code: "INVALID", message: "Enter a valid email address." },
  ]);

// Sends a new code, replacing any earlier one for the same email.
emailVerificationsRouter.post("/", async (request, response) => {
  const email = normalizeEmail(asObject(request.body).email);
  if (!looksLikeEmail(email)) return invalidEmail(response);

  try {
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) return fail(response, 409, "ACCOUNT_EXISTS", "An account already exists with this email.");

    const now = new Date();
    const previous = await prisma.emailVerification.findUnique({ where: { email } });
    if (previous && now.getTime() - previous.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now.getTime() - previous.lastSentAt.getTime())) / 1000);
      response.set("Retry-After", String(retryAfterSeconds));
      return fail(response, 429, "RESEND_TOO_SOON", "Please wait before requesting another code.");
    }

    const code = generateCode();
    const fresh = { codeHash: hashCode(code), expiresAt: new Date(now.getTime() + CODE_TTL_MS), attempts: 0, lastSentAt: now, verifiedAt: null };
    await prisma.emailVerification.upsert({ where: { email }, create: { email, ...fresh }, update: fresh });
    await sendVerificationCodeEmail(email, code);

    return response.status(201).json({ email, expiresAt: fresh.expiresAt, resendAvailableAt: new Date(now.getTime() + RESEND_COOLDOWN_MS) });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Verification code request failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not send the verification code.");
  }
});

// Checks a code. A correct one marks the email verified for account creation.
emailVerificationsRouter.post("/verify", async (request, response) => {
  const body = asObject(request.body);
  const email = normalizeEmail(body.email);
  if (!looksLikeEmail(email)) return invalidEmail(response);
  if (!isCode(body.code)) {
    return fail(response, 422, "VALIDATION_ERROR", "Enter the 6-digit code.", [
      { field: "code", code: "INVALID", message: "Enter the 6-digit code." },
    ]);
  }

  try {
    const verification = await prisma.emailVerification.findUnique({ where: { email } });
    if (!verification) return fail(response, 404, "CODE_NOT_FOUND", "Request a verification code first.");
    if (verification.verifiedAt) return response.status(200).json({ email, verified: true });
    if (verification.attempts >= MAX_ATTEMPTS) return fail(response, 429, "TOO_MANY_ATTEMPTS", "Too many incorrect codes. Request a new code.");
    if (verification.expiresAt.getTime() <= Date.now()) return fail(response, 410, "CODE_EXPIRED", "This code has expired. Request a new code.");

    if (!codesMatch(body.code, verification.codeHash)) {
      const { attempts } = await prisma.emailVerification.update({ where: { email }, data: { attempts: { increment: 1 } }, select: { attempts: true } });
      const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attempts);
      return attemptsLeft === 0
        ? fail(response, 429, "TOO_MANY_ATTEMPTS", "Too many incorrect codes. Request a new code.")
        : fail(response, 400, "CODE_INCORRECT", `That code is incorrect. ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left.`);
    }

    await prisma.emailVerification.update({ where: { email }, data: { verifiedAt: new Date() } });
    return response.status(200).json({ email, verified: true });
  } catch (error) {
    request.log?.error({ requestId: request.id, err: error }, "Verification code check failed");
    return fail(response, 500, "INTERNAL_SERVER_ERROR", "Could not check the verification code.");
  }
});
