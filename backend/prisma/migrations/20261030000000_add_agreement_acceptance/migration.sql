-- Record when users accept the Terms/Privacy Policy and when booking owners accept the trek waiver.
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "waiverAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "waiverVersion" TEXT;
