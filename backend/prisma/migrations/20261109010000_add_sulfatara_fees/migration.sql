-- Sulfatara charges the same fees as Mt. Malingatong. Existing bookings keep
-- the price they were made at.
UPDATE "trails"
SET "garbageFee" = 20, "environmentalFee" = 30, "entranceFeePerPerson" = 50
WHERE "id" = 'trl_sulfatara';
