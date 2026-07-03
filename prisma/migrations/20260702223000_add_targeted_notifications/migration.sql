ALTER TABLE "notifications" ADD COLUMN "recipient_user_id" TEXT;

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_recipient_user_id_fkey"
FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "notifications_recipient_user_id_created_at_idx"
ON "notifications"("recipient_user_id", "created_at");
