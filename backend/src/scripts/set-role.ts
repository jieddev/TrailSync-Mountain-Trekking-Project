// Sets the role of an existing TrailSync user. This is the only way to create
// GUIDE or COORDINATOR accounts; there is deliberately no HTTP endpoint for it.
//
//   npm run set-role -- user@example.com COORDINATOR
import "dotenv/config";
import { UserRole } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

const roles = Object.values(UserRole);
const [email, role] = process.argv.slice(2);

async function main() {
  if (!email || !role || !roles.includes(role as UserRole)) {
    console.error(`Usage: npm run set-role -- <email> <${roles.join("|")}>`);
    process.exitCode = 1;
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true, role: true } });
  if (!user) {
    console.error(`No TrailSync user with email ${normalizedEmail}. The person must register first.`);
    process.exitCode = 1;
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: role as UserRole },
    select: { fullName: true, email: true, role: true },
  });
  console.log(`${updated.fullName} <${updated.email}>: ${user.role} -> ${updated.role}`);
}

main()
  .catch((error) => {
    console.error("Could not update the user's role.", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
