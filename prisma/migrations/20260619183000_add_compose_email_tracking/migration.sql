-- CreateTable
CREATE TABLE "compose_email_logs" (
    "id" TEXT NOT NULL,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "heading" TEXT,
    "status" TEXT NOT NULL,
    "provider_id" TEXT,
    "message" TEXT,
    "metadata" JSONB,
    "opened_at" TIMESTAMP(3),
    "last_opened_at" TIMESTAMP(3),
    "open_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_at" TIMESTAMP(3),
    "last_clicked_at" TIMESTAMP(3),
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compose_email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compose_email_logs_to_email_idx" ON "compose_email_logs"("to_email");
