-- Lake Janagdan was removed from scope. Retire it instead of deleting it, because existing bookings still reference it.
UPDATE "trails" SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'trl_lake_janagdan';

-- Sulfatara replaces Lake Janagdan as the approved trail.
INSERT INTO "trails" ("id", "slug", "name", "packagePrice", "isActive", "updatedAt")
VALUES ('trl_sulfatara', 'sulfatara', 'Sulfatara', 550, true, CURRENT_TIMESTAMP);
