import nodemailer, { type Transporter } from "nodemailer";

import { logger } from "./logger.js";

let transport: Transporter | null | undefined;

// SMTP from .env (Gmail: smtp.gmail.com, port 465, an app password). Without
// SMTP_USER nothing is sent and the email is only logged, for dev and tests.
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

  const mailer = smtp();
  if (!mailer) {
    logger.info({ to, subject, filename }, "SMTP_USER not set; certificate email not sent");
    return;
  }
  await mailer.sendMail({
    from: process.env.MAIL_FROM ?? `TrailSync <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
    attachments: [{ filename, content: Buffer.from(pdf), contentType: "application/pdf" }],
  });
}
