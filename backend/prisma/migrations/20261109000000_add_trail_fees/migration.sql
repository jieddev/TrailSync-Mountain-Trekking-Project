-- Fees added on top of a trail's package price, snapshotted onto each booking.
-- Existing bookings keep the price they were made at (fees default to 0).
ALTER TABLE "trails"
  ADD COLUMN "garbageFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "environmentalFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "entranceFeePerPerson" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "bookings"
  ADD COLUMN "garbageFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "environmentalFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "entranceFee" INTEGER NOT NULL DEFAULT 0;

UPDATE "trails"
SET "garbageFee" = 20, "environmentalFee" = 30, "entranceFeePerPerson" = 50
WHERE "id" = 'trl_mt_malingatong';
