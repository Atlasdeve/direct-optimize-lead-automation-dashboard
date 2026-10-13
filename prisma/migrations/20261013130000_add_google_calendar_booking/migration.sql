CREATE TABLE "booking_settings" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
  "appointment_duration_minutes" INTEGER NOT NULL DEFAULT 30,
  "buffer_minutes" INTEGER NOT NULL DEFAULT 0,
  "minimum_notice_minutes" INTEGER NOT NULL DEFAULT 120,
  "maximum_days_ahead" INTEGER NOT NULL DEFAULT 30,
  "availability" JSONB,
  "event_title" TEXT NOT NULL DEFAULT 'Discovery call',
  "event_description" TEXT,
  "is_public" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "booking_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "google_calendar_connections" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "calendar_id" TEXT NOT NULL DEFAULT 'primary',
  "google_account_email" TEXT,
  "encrypted_refresh_token" TEXT NOT NULL,
  "scope" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "booking_appointments" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "booking_settings_id" TEXT,
  "lead_id" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "company_name" TEXT,
  "phone" TEXT,
  "notes" TEXT,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'confirmed',
  "source" TEXT NOT NULL DEFAULT 'public_booking',
  "google_event_id" TEXT,
  "calendar_sync_status" TEXT NOT NULL DEFAULT 'not_connected',
  "booking_token" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "booking_appointments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_settings_organization_id_key" ON "booking_settings"("organization_id");
CREATE UNIQUE INDEX "google_calendar_connections_organization_id_key" ON "google_calendar_connections"("organization_id");
CREATE UNIQUE INDEX "booking_appointments_google_event_id_key" ON "booking_appointments"("google_event_id");
CREATE UNIQUE INDEX "booking_appointments_booking_token_key" ON "booking_appointments"("booking_token");
CREATE UNIQUE INDEX "booking_appointments_organization_id_starts_at_key" ON "booking_appointments"("organization_id", "starts_at");
CREATE INDEX "booking_appointments_organization_id_starts_at_idx" ON "booking_appointments"("organization_id", "starts_at");
CREATE INDEX "booking_appointments_booking_settings_id_starts_at_idx" ON "booking_appointments"("booking_settings_id", "starts_at");
CREATE INDEX "booking_appointments_lead_id_idx" ON "booking_appointments"("lead_id");

ALTER TABLE "booking_settings" ADD CONSTRAINT "booking_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_appointments" ADD CONSTRAINT "booking_appointments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_appointments" ADD CONSTRAINT "booking_appointments_booking_settings_id_fkey" FOREIGN KEY ("booking_settings_id") REFERENCES "booking_settings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking_appointments" ADD CONSTRAINT "booking_appointments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
