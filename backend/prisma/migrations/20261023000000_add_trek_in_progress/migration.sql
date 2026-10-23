-- AlterEnum
-- BEFORE 'COMPLETED' keeps the enum order matching the lifecycle, so sorting by
-- status still lists active treks before completed ones.
ALTER TYPE "BookingStatus" ADD VALUE 'IN_PROGRESS' BEFORE 'COMPLETED';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "trekStartedAt" TIMESTAMP(3);
