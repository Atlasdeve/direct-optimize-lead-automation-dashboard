ALTER TABLE "call_logs"
  ALTER COLUMN "lead_id" DROP NOT NULL,
  ADD COLUMN "contact_name" TEXT,
  ADD COLUMN "company_name" TEXT;
