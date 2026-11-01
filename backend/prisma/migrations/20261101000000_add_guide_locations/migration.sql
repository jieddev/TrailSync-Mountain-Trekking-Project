-- Live guide tracking: GPS fixes a guide's app uploads during a started trek.
-- CreateTable
CREATE TABLE "guide_locations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guide_locations_bookingId_recordedAt_idx" ON "guide_locations"("bookingId", "recordedAt");

-- AddForeignKey
ALTER TABLE "guide_locations" ADD CONSTRAINT "guide_locations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_locations" ADD CONSTRAINT "guide_locations_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
