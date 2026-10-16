-- CreateTable
CREATE TABLE "trails" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "packagePrice" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trails_slug_key" ON "trails"("slug");

-- Seed the approved trail catalog. Additional trails require their own migration with verified data.
INSERT INTO "trails" ("id", "slug", "name", "packagePrice", "isActive", "updatedAt")
VALUES ('trl_lake_janagdan', 'lake-janagdan', 'Lake Janagdan', 800, true, CURRENT_TIMESTAMP);

-- Link existing bookings (all created for Lake Janagdan) to the catalog entry.
ALTER TABLE "bookings" ADD COLUMN "trailId" TEXT;
UPDATE "bookings" SET "trailId" = 'trl_lake_janagdan';
ALTER TABLE "bookings" ALTER COLUMN "trailId" SET NOT NULL;
ALTER TABLE "bookings" DROP COLUMN "trail";

-- Snapshot the 50% downpayment alongside the package price.
ALTER TABLE "bookings" ADD COLUMN "downpaymentAmount" INTEGER;
UPDATE "bookings" SET "downpaymentAmount" = ROUND("packagePrice" * 0.5);
ALTER TABLE "bookings" ALTER COLUMN "downpaymentAmount" SET NOT NULL;
ALTER TABLE "bookings" ALTER COLUMN "packagePrice" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "bookings_trailId_scheduledDate_idx" ON "bookings"("trailId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trailId_fkey" FOREIGN KEY ("trailId") REFERENCES "trails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
