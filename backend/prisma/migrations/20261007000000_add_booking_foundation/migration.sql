-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "DownpaymentStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED');

-- CreateEnum
CREATE TYPE "BookingParticipantType" AS ENUM ('BOOKING_OWNER', 'ADDITIONAL_PARTICIPANT');

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "trail" TEXT NOT NULL DEFAULT 'Lake Janagdan',
    "scheduledDate" TEXT NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "packagePrice" INTEGER NOT NULL DEFAULT 800,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "downpaymentStatus" "DownpaymentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_participants" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" "BookingParticipantType" NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "booking_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_ownerId_createdAt_idx" ON "bookings"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "booking_participants_bookingId_idx" ON "booking_participants"("bookingId");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
