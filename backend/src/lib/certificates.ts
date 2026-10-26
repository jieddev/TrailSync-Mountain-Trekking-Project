import type { Logger } from "pino";

import { renderCertificatePdf } from "./certificate-pdf.js";
import { logger as defaultLogger } from "./logger.js";
import { sendCertificateEmail } from "./mailer.js";
import { prisma } from "./prisma.js";

// Emails a certificate to every hiker who went on a completed trek and has not
// had one yet. Hikers without an email get theirs at the booking owner's. Never
// throws: the trek is already completed, so failures are only logged and the
// coordinator can resend. Returns how many certificates were sent.
export async function sendTrekCertificates(bookingId: string, log: Logger = defaultLogger): Promise<number> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        status: true,
        completedAt: true,
        trail: { select: { name: true } },
        owner: { select: { email: true } },
        guide: { select: { user: { select: { fullName: true } } } },
        participants: {
          // Absent hikers did not go, so they get no certificate.
          where: { certificateSentAt: null, OR: [{ attendance: null }, { attendance: "PRESENT" }] },
          select: { id: true, name: true, email: true },
          orderBy: [{ kind: "asc" }, { id: "asc" }],
        },
      },
    });
    if (booking?.status !== "COMPLETED") return 0;

    let sent = 0;
    for (const participant of booking.participants) {
      const to = participant.email ?? booking.owner.email;
      // Claim it first, so a resend running at the same time cannot send it twice.
      const claimed = await prisma.bookingParticipant.updateMany({
        where: { id: participant.id, certificateSentAt: null },
        data: { certificateSentAt: new Date() },
      });
      if (!claimed.count) continue;
      try {
        const pdf = await renderCertificatePdf({
          recipient: participant.name,
          trailName: booking.trail.name,
          date: booking.completedAt ?? new Date(),
          guideName: booking.guide?.user.fullName ?? "TrailSync Guide",
        });
        await sendCertificateEmail(to, participant.name, booking.trail.name, pdf);
        sent++;
      } catch (error) {
        log.error({ err: error, bookingId, participantId: participant.id }, "Certificate email failed");
        // Unclaim, so a resend picks it up.
        await prisma.bookingParticipant.updateMany({ where: { id: participant.id }, data: { certificateSentAt: null } });
      }
    }
    if (sent) log.info({ bookingId, sent }, "Certificates emailed");
    return sent;
  } catch (error) {
    log.error({ err: error, bookingId }, "Certificate emails failed");
    return 0;
  }
}
