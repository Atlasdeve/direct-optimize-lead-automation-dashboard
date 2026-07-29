CREATE TABLE "follow_up_reminders" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT,
    "adult_lead_id" TEXT,
    "created_by_user_id" TEXT,
    "preset" TEXT NOT NULL,
    "note" TEXT,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "notified_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_up_reminders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "follow_up_reminders_one_lead_check"
      CHECK (
        ("lead_id" IS NOT NULL AND "adult_lead_id" IS NULL)
        OR ("lead_id" IS NULL AND "adult_lead_id" IS NOT NULL)
      )
);

CREATE INDEX "follow_up_reminders_status_due_at_idx"
ON "follow_up_reminders"("status", "due_at");

CREATE INDEX "follow_up_reminders_lead_id_status_idx"
ON "follow_up_reminders"("lead_id", "status");

CREATE INDEX "follow_up_reminders_adult_lead_id_status_idx"
ON "follow_up_reminders"("adult_lead_id", "status");

ALTER TABLE "follow_up_reminders"
ADD CONSTRAINT "follow_up_reminders_lead_id_fkey"
FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "follow_up_reminders"
ADD CONSTRAINT "follow_up_reminders_adult_lead_id_fkey"
FOREIGN KEY ("adult_lead_id") REFERENCES "adult_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "follow_up_reminders"
ADD CONSTRAINT "follow_up_reminders_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
