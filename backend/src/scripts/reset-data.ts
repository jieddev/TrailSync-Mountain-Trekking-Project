// Clears test activity so the system can be tested from a fresh state. Deletes
// bookings (with participants), incidents, trail restrictions and unapproved
// guide applications, and takes every guide off duty. Users, guides, trails and
// approved guide applications are kept.
//
//   npm run reset-data -- --yes
import "dotenv/config";

import { prisma } from "../lib/prisma.js";

async function main() {
  if (!process.argv.slice(2).includes("--yes")) {
    console.error("Usage: npm run reset-data -- --yes");
    console.error("Deletes all bookings, participants, incidents, trail restrictions and unapproved guide applications.");
    console.error("Users, guides, trails and approved guide applications are kept.");
    process.exitCode = 1;
    return;
  }

  // Incidents restrict deleting their booking, so they go first.
  const counts = await prisma.$transaction(async (tx) => ({
    incidents: (await tx.incident.deleteMany()).count,
    bookingParticipants: (await tx.bookingParticipant.deleteMany()).count,
    bookings: (await tx.booking.deleteMany()).count,
    trailRestrictions: (await tx.trailRestriction.deleteMany()).count,
    guideApplications: (await tx.guideApplication.deleteMany({ where: { status: { not: "APPROVED" } } })).count,
    guidesSetOffDuty: (await tx.guide.updateMany({ data: { dutyStatus: "OFF_DUTY", availableSince: null } })).count,
  }));
  console.table(counts);

  const [users, trails] = await Promise.all([prisma.user.count(), prisma.trail.count()]);
  console.log(`Kept ${users} users and ${trails} trails.`);
}

main()
  .catch((error) => {
    console.error("Could not reset the data.", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
