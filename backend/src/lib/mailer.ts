import nodemailer, { type Transporter } from "nodemailer";

import { logger } from "./logger.js";

let transport: Transporter | null | undefined;

type Mail = { to: string; subject: string; text: string; html: string; attachment?: { filename: string; content: Buffer } };

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

// "TrailSync <a@b.com>" or "a@b.com" as Brevo's { name, email }.
export function parseMailFrom(from: string) {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (!match) return { email: from.trim() };
  const name = match[1]!.replace(/^"|"$/g, "").trim();
  return name ? { name, email: match[2]!.trim() } : { email: match[2]!.trim() };
}

// Brevo's HTTP API, for hosts that block SMTP ports (Render's free tier).
// MAIL_FROM must be a sender verified in Brevo.
async function sendWithBrevo(apiKey: string, mail: Mail) {
  const from = process.env.MAIL_FROM?.trim();
  if (!from) throw new Error("MAIL_FROM must be set to a Brevo-verified sender when BREVO_API_KEY is set.");
  const response = await fetch(BREVO_URL, {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: parseMailFrom(from),
      to: [{ email: mail.to }],
      subject: mail.subject,
      textContent: mail.text,
      htmlContent: mail.html,
      ...(mail.attachment && { attachment: [{ name: mail.attachment.filename, content: mail.attachment.content.toString("base64") }] }),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`Brevo answered ${response.status}: ${detail}`);
  }
}

// Sends with Brevo when BREVO_API_KEY is set, else SMTP when SMTP_USER is set.
// With neither, nothing is sent; returns false so the caller can log instead.
async function deliver(mail: Mail) {
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  if (brevoKey) {
    await sendWithBrevo(brevoKey, mail);
    return true;
  }
  const mailer = smtp();
  if (!mailer) return false;
  await mailer.sendMail({
    from: process.env.MAIL_FROM ?? `TrailSync <${process.env.SMTP_USER}>`,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    ...(mail.attachment && { attachments: [{ filename: mail.attachment.filename, content: mail.attachment.content, contentType: "application/pdf" }] }),
  });
  return true;
}

// SMTP from .env (Gmail: smtp.gmail.com, port 465, an app password), for local
// development. Without SMTP_USER there is no transport.
function smtp() {
  if (transport !== undefined) return transport;
  const user = process.env.SMTP_USER;
  if (!user) return (transport = null);
  const port = Number(process.env.SMTP_PORT ?? 465);
  return (transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user, pass: process.env.SMTP_PASS },
  }));
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Emails one hiker's certificate as a PDF attachment.
export async function sendCertificateEmail(to: string, recipient: string, trailName: string, pdf: Uint8Array) {
  const subject = `Your TrailSync certificate for ${trailName}`;
  const text = `Hi ${recipient},\n\nCongratulations on completing ${trailName}! Your certificate of achievement is attached.\n\nSee you on the next trail,\nTrailSync`;
  const html = `<p>Hi ${escapeHtml(recipient)},</p><p>Congratulations on completing <strong>${escapeHtml(trailName)}</strong>! Your certificate of achievement is attached.</p><p>See you on the next trail,<br>TrailSync</p>`;
  const filename = `TrailSync-Certificate-${recipient.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")}.pdf`;

  if (!(await deliver({ to, subject, text, html, attachment: { filename, content: Buffer.from(pdf) } }))) {
    logger.info({ to, subject, filename }, "No mail service configured; certificate email not sent");
  }
}

// Emails the one-time code a new hiker enters to confirm their address.
export async function sendVerificationCodeEmail(to: string, code: string) {
  const subject = `Your TrailSync verification code: ${code}`;
  const text = `Your TrailSync verification code is ${code}.\n\nEnter it on the sign-up page to create your account. It expires in 10 minutes.\n\nIf you didn't try to create a TrailSync account, you can ignore this email.\n\nTrailSync`;
  const html = `<p>Your TrailSync verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${escapeHtml(code)}</p><p>Enter it on the sign-up page to create your account. It expires in 10 minutes.</p><p>If you didn't try to create a TrailSync account, you can ignore this email.</p><p>TrailSync</p>`;

  if (!(await deliver({ to, subject, text, html }))) {
    // Dev and tests only: without a mail service the code is logged so sign-up still works.
    logger.info({ to, code }, "No mail service configured; verification code email not sent");
  }
}
