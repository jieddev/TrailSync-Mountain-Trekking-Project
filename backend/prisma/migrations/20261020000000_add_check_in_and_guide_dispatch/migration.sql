-- CreateEnum
CREATE TYPE "ParticipantAttendance" AS ENUM ('PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "GuideDutyStatus" AS ENUM ('OFF_DUTY', 'AVAILABLE', 'ASSIGNED');

-- AlterEnum

ALTER TYPE "BookingStatus" ADD VALUE 'CHECKED_IN';
ALTER TYPE "BookingStatus" ADD VALUE 'GUIDE_ASSIGNED';
ALTER TYPE "BookingStatus" ADD VALUE 'COMPLETED';

-- AlterEnum
ALTER TYPE "BookingParticipantType" ADD VALUE 'WALK_IN';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "guideAssignedAt" TIMESTAMP(3),
ADD COLUMN     "guideId" TEXT;

-- AlterTable
ALTER TABLE "booking_participants" ADD COLUMN     "attendance" "ParticipantAttendance";

-- CreateTable
CREATE TABLE "guides" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dutyStatus" "GuideDutyStatus" NOT NULL DEFAULT 'OFF_DUTY',
    "availableSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guides_userId_key" ON "guides"("userId");

-- CreateIndex
CREATE INDEX "guides_dutyStatus_availableSince_idx" ON "guides"("dutyStatus", "availableSince");

-- CreateIndex
CREATE INDEX "bookings_status_checkedInAt_idx" ON "bookings"("status", "checkedInAt");

-- CreateIndex
CREATE INDEX "bookings_guideId_idx" ON "bookings"("guideId");

-- AddForeignKey
ALTER TABLE "guides" ADD CONSTRAINT "guides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

