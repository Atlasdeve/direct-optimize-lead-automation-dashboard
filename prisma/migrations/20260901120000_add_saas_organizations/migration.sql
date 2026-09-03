CREATE TABLE "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "company_name" TEXT NOT NULL,
  "logo_url" TEXT,
  "brand_color" TEXT NOT NULL DEFAULT '#38bdf8',
  "plan" TEXT NOT NULL DEFAULT 'starter',
  "billing_status" TEXT NOT NULL DEFAULT 'trial',
  "setup_fee_status" TEXT NOT NULL DEFAULT 'pending',
  "monthly_price_cents" INTEGER NOT NULL DEFAULT 9900,
  "setup_fee_cents" INTEGER NOT NULL DEFAULT 25000,
  "system_status" TEXT NOT NULL DEFAULT 'active',
  "custom_domain" TEXT,
  "subdomain" TEXT,
  "trial_ends_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_api_settings" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "google_places_api_key" TEXT,
  "google_search_api_key" TEXT,
  "google_search_cx" TEXT,
  "brevo_api_key" TEXT,
  "brevo_smtp_key" TEXT,
  "smtp_host" TEXT,
  "smtp_port" INTEGER,
  "smtp_user" TEXT,
  "smtp_pass" TEXT,
  "smtp_secure" BOOLEAN,
  "telnyx_api_key" TEXT,
  "telnyx_connection_id" TEXT,
  "telnyx_phone_number" TEXT,
  "openai_api_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_api_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE UNIQUE INDEX "organizations_custom_domain_key" ON "organizations"("custom_domain");
CREATE UNIQUE INDEX "organizations_subdomain_key" ON "organizations"("subdomain");
CREATE INDEX "organizations_plan_idx" ON "organizations"("plan");
CREATE INDEX "organizations_billing_status_idx" ON "organizations"("billing_status");
CREATE INDEX "organizations_system_status_idx" ON "organizations"("system_status");
CREATE UNIQUE INDEX "organization_api_settings_organization_id_key" ON "organization_api_settings"("organization_id");

INSERT INTO "organizations" (
  "id",
  "name",
  "slug",
  "company_name",
  "plan",
  "billing_status",
  "setup_fee_status",
  "monthly_price_cents",
  "setup_fee_cents",
  "system_status"
) VALUES (
  'org_direct_optimize',
  'Direct Optimize',
  'direct-optimize',
  'Direct Optimize',
  'agency_pro',
  'active',
  'paid',
  79900,
  50000,
  'active'
) ON CONFLICT ("slug") DO NOTHING;

ALTER TABLE "users" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "regions" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "leads" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "adult_leads" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "adult_lead_countries" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "follow_up_reminders" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "call_logs" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "client_projects" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "compose_email_logs" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "email_templates" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "whatsapp_templates" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "automation_runs" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "notifications" ADD COLUMN "organization_id" TEXT;

UPDATE "users" SET "organization_id" = 'org_direct_optimize' WHERE "organization_id" IS NULL;
UPDATE "regions" SET "organization_id" = 'org_direct_optimize' WHERE "organization_id" IS NULL;
UPDATE "leads" SET "organization_id" = 'org_direct_optimize' WHERE "organization_id" IS NULL;
UPDATE "adult_leads" SET "organization_id" = 'org_direct_optimize' WHERE "organization_id" IS NULL;
UPDATE "adult_lead_countries" SET "organization_id" = 'org_direct_optimize' WHERE "organization_id" IS NULL;
UPDATE "follow_up_reminders" SET "organization_id" = 'org_direct_optimize' WHERE "organization_id" IS NULL;
UPDATE "call_logs" SET "organization_id" = 'org_direct_optimize' WHERE "organization_id" IS NULL;
UPDATE "client_projects" SET "organization_id" = 'org_direct_optimize' WHERE "organization_id" IS NULL;
UPDATE "compose_email_logs" SET "organization_id" = 'org_direct_optimize' WHERE "organization_id" IS NULL;
UPDATE "email_templates" SET "organization_id" = 'org_direct_optimize' WHERE "organization_id" IS NULL;
UPDATE "whatsapp_templates" SET "organization_id" = 'org_direct_optimize' WHERE "organization_id" IS NULL;
UPDATE "automation_runs" SET "organization_id" = 'org_direct_optimize' WHERE "organization_id" IS NULL;
UPDATE "notifications" SET "organization_id" = 'org_direct_optimize' WHERE "organization_id" IS NULL;

CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");
CREATE INDEX "regions_organization_id_idx" ON "regions"("organization_id");
CREATE INDEX "leads_organization_id_idx" ON "leads"("organization_id");
CREATE INDEX "adult_leads_organization_id_idx" ON "adult_leads"("organization_id");
CREATE INDEX "adult_lead_countries_organization_id_idx" ON "adult_lead_countries"("organization_id");
CREATE INDEX "follow_up_reminders_organization_id_idx" ON "follow_up_reminders"("organization_id");
CREATE INDEX "call_logs_organization_id_idx" ON "call_logs"("organization_id");
CREATE INDEX "client_projects_organization_id_idx" ON "client_projects"("organization_id");
CREATE INDEX "compose_email_logs_organization_id_idx" ON "compose_email_logs"("organization_id");
CREATE INDEX "email_templates_organization_id_idx" ON "email_templates"("organization_id");
CREATE INDEX "whatsapp_templates_organization_id_idx" ON "whatsapp_templates"("organization_id");
CREATE INDEX "automation_runs_organization_id_idx" ON "automation_runs"("organization_id");
CREATE INDEX "notifications_organization_id_idx" ON "notifications"("organization_id");

ALTER TABLE "organization_api_settings" ADD CONSTRAINT "organization_api_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "regions" ADD CONSTRAINT "regions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "adult_leads" ADD CONSTRAINT "adult_leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "adult_lead_countries" ADD CONSTRAINT "adult_lead_countries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "follow_up_reminders" ADD CONSTRAINT "follow_up_reminders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_projects" ADD CONSTRAINT "client_projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compose_email_logs" ADD CONSTRAINT "compose_email_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
