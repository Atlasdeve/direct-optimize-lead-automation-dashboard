CREATE TABLE "lead_website_visits" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "page_url" TEXT,
    "page_title" TEXT,
    "referrer" TEXT,
    "utm_campaign" TEXT,
    "utm_term" TEXT,
    "user_agent" TEXT,
    "ip" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_notified_at" TIMESTAMP(3),
    "visit_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "lead_website_visits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lead_website_visits_lead_id_visitor_id_key" ON "lead_website_visits"("lead_id", "visitor_id");
CREATE INDEX "lead_website_visits_last_seen_at_idx" ON "lead_website_visits"("last_seen_at");
CREATE INDEX "lead_website_visits_lead_id_last_seen_at_idx" ON "lead_website_visits"("lead_id", "last_seen_at");

ALTER TABLE "lead_website_visits" ADD CONSTRAINT "lead_website_visits_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
