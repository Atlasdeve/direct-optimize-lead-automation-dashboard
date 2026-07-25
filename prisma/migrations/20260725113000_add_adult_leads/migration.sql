CREATE TABLE "adult_leads" (
    "id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "category" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source_title" TEXT,
    "source_snippet" TEXT,
    "source_query" TEXT,
    "review_status" TEXT NOT NULL DEFAULT 'Unverified',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adult_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "adult_leads_website_key" ON "adult_leads"("website");
CREATE INDEX "adult_leads_country_idx" ON "adult_leads"("country");
CREATE INDEX "adult_leads_category_idx" ON "adult_leads"("category");
CREATE INDEX "adult_leads_review_status_idx" ON "adult_leads"("review_status");
