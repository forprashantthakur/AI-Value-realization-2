-- Administrator-defined roles: description and built-in flag on Role.
ALTER TABLE "Role" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Role" ADD COLUMN "builtIn" BOOLEAN NOT NULL DEFAULT false;

-- Existing rows are the shipped roles.
UPDATE "Role" SET "builtIn" = true WHERE "id" IN (
  'ENTERPRISE_ADMIN', 'AI_VALUE_OFFICE', 'FINANCE_VALIDATOR', 'BUSINESS_OWNER',
  'PROCESS_OWNER', 'AI_PRODUCT_OWNER', 'CONSULTANT', 'VIEWER'
);
