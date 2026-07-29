ALTER TABLE "adult_leads"
ADD COLUMN "outreach_status" TEXT NOT NULL DEFAULT 'New',
ADD COLUMN "outreach_approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "outreach_approved_at" TIMESTAMP(3),
ADD COLUMN "email_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "email_opened" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "email_clicked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "last_contacted_at" TIMESTAMP(3);

CREATE INDEX "adult_leads_outreach_approved_email_sent_idx"
ON "adult_leads"("outreach_approved", "email_sent");
