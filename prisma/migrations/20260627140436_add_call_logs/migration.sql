-- CreateTable
CREATE TABLE "call_logs" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "user_id" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "provider_call_sid" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "outcome" TEXT,
    "notes" TEXT,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "answered_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "follow_up_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_logs_provider_call_sid_key" ON "call_logs"("provider_call_sid");

-- CreateIndex
CREATE INDEX "call_logs_lead_id_created_at_idx" ON "call_logs"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "call_logs_user_id_idx" ON "call_logs"("user_id");

-- CreateIndex
CREATE INDEX "call_logs_status_idx" ON "call_logs"("status");

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
