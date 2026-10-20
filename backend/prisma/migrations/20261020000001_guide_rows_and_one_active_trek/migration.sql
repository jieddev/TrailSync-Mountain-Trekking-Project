-- Every GUIDE user gets a dispatch row. New guides get theirs when a coordinator
-- approves the account request (or set-role promotes them); this covers existing ones.
INSERT INTO "guides" ("id", "userId", "dutyStatus", "createdAt", "updatedAt")
SELECT 'guide_' || "id", "id", 'OFF_DUTY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users"
WHERE "role" = 'GUIDE'
ON CONFLICT ("userId") DO NOTHING;

-- Backstop for FIFO dispatch: a guide can lead at most one active trek. Kept in a
-- separate migration because PostgreSQL cannot use the new GUIDE_ASSIGNED enum
-- value in the transaction that added it.
CREATE UNIQUE INDEX "bookings_one_active_trek_per_guide" ON "bookings" ("guideId") WHERE "status" = 'GUIDE_ASSIGNED';
