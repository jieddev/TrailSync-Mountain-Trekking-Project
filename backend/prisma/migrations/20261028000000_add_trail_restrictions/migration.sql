-- Phase 8: a coordinator closes a trail for an inclusive range of Asia/Manila
-- dates (YYYY-MM-DD, the same format as bookings.scheduledDate). Lifted rows are
-- kept as a record.
-- CreateTable
CREATE TABLE "trail_restrictions" (
    "id" TEXT NOT NULL,
    "trailId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "liftedAt" TIMESTAMP(3),
    "liftedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trail_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trail_restrictions_trailId_startDate_endDate_idx" ON "trail_restrictions"("trailId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "trail_restrictions" ADD CONSTRAINT "trail_restrictions_trailId_fkey" FOREIGN KEY ("trailId") REFERENCES "trails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_restrictions" ADD CONSTRAINT "trail_restrictions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_restrictions" ADD CONSTRAINT "trail_restrictions_liftedById_fkey" FOREIGN KEY ("liftedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A range never ends before it starts. Text comparison is correct for YYYY-MM-DD.
ALTER TABLE "trail_restrictions" ADD CONSTRAINT "trail_restrictions_date_range_check" CHECK ("startDate" <= "endDate");
