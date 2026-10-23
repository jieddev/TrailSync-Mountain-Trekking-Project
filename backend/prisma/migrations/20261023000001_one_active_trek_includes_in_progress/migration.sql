-- A started trek is still the guide's active trek, so the one-active-trek backstop
-- covers IN_PROGRESS as well. Kept in a separate migration because PostgreSQL
-- cannot use the new IN_PROGRESS enum value in the transaction that added it.
DROP INDEX "bookings_one_active_trek_per_guide";
CREATE UNIQUE INDEX "bookings_one_active_trek_per_guide" ON "bookings" ("guideId") WHERE "status" IN ('GUIDE_ASSIGNED', 'IN_PROGRESS');
