ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_lead_id_fkey";
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_lead_id_fkey"
FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
