-- CreateEnum
CREATE TYPE "GuideApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "guide_applications" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "GuideApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "declineReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guide_applications_firebaseUid_key" ON "guide_applications"("firebaseUid");

-- CreateIndex
CREATE INDEX "guide_applications_status_createdAt_idx" ON "guide_applications"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "guide_applications" ADD CONSTRAINT "guide_applications_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
