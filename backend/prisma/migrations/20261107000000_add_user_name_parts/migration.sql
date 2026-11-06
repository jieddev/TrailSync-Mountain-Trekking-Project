-- Hiker name parts entered at sign-up. fullName stays and is built from them.
-- Existing accounts keep only fullName; their names are not split.
-- AlterTable
ALTER TABLE "users" ADD COLUMN "firstName" TEXT,
ADD COLUMN "middleName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "suffix" TEXT;
