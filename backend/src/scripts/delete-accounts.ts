// Deletes every TrailSync account from the LOCAL database, with everything that
// belongs to them (bookings, participants, payment receipts, incidents, guide
// locations, trail restrictions, guide applications, guides, email codes), and
// deletes their Firebase logins so the emails can be registered again.
// Trails are kept.
//
// Local and Render share one Firebase project, so these Firebase logins stop
// working on the live site too.
//
//   npm run delete-accounts -- --yes
import "dotenv/config";

import { firebaseAuth } from "../lib/firebase-admin.js";
import { prisma } from "../lib/prisma.js";
import { deleteAllReceiptFiles } from "../lib/receipt-upload.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const FIREBASE_BATCH_SIZE = 1000;

function databaseHost() {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return undefined;
  }
}

async function deleteFirebaseUsers(uids: string[]) {
  let deleted = 0;
  const failures: { uid: string; message: string }[] = [];
  for (let start = 0; start < uids.length; start += FIREBASE_BATCH_SIZE) {
    const batch = uids.slice(start, start + FIREBASE_BATCH_SIZE);
    const result = await firebaseAuth.deleteUsers(batch);
    deleted += result.successCount;
    for (const error of result.errors) failures.push({ uid: batch[error.index]!, message: error.error.message });
  }
  return { deleted, failures };
}

async function main() {
  if (!process.argv.slice(2).includes("--yes")) {
    console.error("Usage: npm run delete-accounts -- --yes");
    console.error("Deletes every user (hikers, guides, coordinators) from the local database with their bookings,");
    console.error("participants, payment receipts, incidents, guide locations, trail restrictions, guide applications");
    console.error("and email codes, and deletes their Firebase logins. Trails are kept.");
    process.exitCode = 1;
    return;
  }

  const host = databaseHost();
  if (!host || !LOCAL_HOSTS.has(host)) {
    console.error(`Refusing to run: DATABASE_URL points at "${host ?? "an invalid URL"}", not a local database.`);
    process.exitCode = 1;
    return;
  }

  // Collected before the rows are gone. Guide applicants have Firebase logins too.
  const [users, applications] = await Promise.all([
    prisma.user.findMany({ select: { firebaseUid: true } }),
    prisma.guideApplication.findMany({ select: { firebaseUid: true } }),
  ]);
  const firebaseUids = [...new Set([...users, ...applications].map((row) => row.firebaseUid))];

  // Children before parents: incidents, guide locations and bookings restrict
  // deleting the guides and users they point at.
  const counts = await prisma.$transaction(async (tx) => ({
    incidents: (await tx.incident.deleteMany()).count,
    guideLocations: (await tx.guideLocation.deleteMany()).count,
    paymentReceipts: (await tx.paymentReceipt.deleteMany()).count,
    bookingParticipants: (await tx.bookingParticipant.deleteMany()).count,
    bookings: (await tx.booking.deleteMany()).count,
    trailRestrictions: (await tx.trailRestriction.deleteMany()).count,
    guideApplications: (await tx.guideApplication.deleteMany()).count,
    guides: (await tx.guide.deleteMany()).count,
    users: (await tx.user.deleteMany()).count,
    emailVerifications: (await tx.emailVerification.deleteMany()).count,
  }));
  console.table(counts);
  await deleteAllReceiptFiles();

  const firebase = await deleteFirebaseUsers(firebaseUids);
  console.log(`Deleted ${firebase.deleted} of ${firebaseUids.length} Firebase logins.`);
  if (firebase.failures.length > 0) {
    console.error("These Firebase logins could not be deleted; remove them in Firebase Console > Authentication:");
    console.table(firebase.failures);
    process.exitCode = 1;
  }

  console.log(`Kept ${await prisma.trail.count()} trails.`);
}

main()
  .catch((error) => {
    console.error("Could not delete the accounts.", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
