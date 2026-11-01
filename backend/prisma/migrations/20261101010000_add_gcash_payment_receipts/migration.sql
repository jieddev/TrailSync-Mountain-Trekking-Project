-- GCash payment (test mode): payment option, receipt screenshots, cash balance at check-in.
-- AlterEnum
ALTER TYPE "DownpaymentStatus" ADD VALUE 'REJECTED';

-- CreateEnum
CREATE TYPE "PaymentOption" AS ENUM ('DOWNPAYMENT', 'FULL');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "paymentOption" "PaymentOption" NOT NULL DEFAULT 'DOWNPAYMENT',
ADD COLUMN "balanceCollectedAt" TIMESTAMP(3),
ADD COLUMN "balanceCollectedById" TEXT;

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "referenceNumber" TEXT,
    "storedFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'SUBMITTED',
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_storedFileName_key" ON "payment_receipts"("storedFileName");

-- CreateIndex
CREATE INDEX "payment_receipts_bookingId_createdAt_idx" ON "payment_receipts"("bookingId", "createdAt");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_balanceCollectedById_fkey" FOREIGN KEY ("balanceCollectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
