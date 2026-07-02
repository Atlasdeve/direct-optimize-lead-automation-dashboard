-- CreateTable
CREATE TABLE "client_projects" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT,
    "client_user_id" TEXT,
    "employee_user_id" TEXT,
    "company_name" TEXT NOT NULL,
    "website_url" TEXT,
    "gmb_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Onboarding',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "estimated_minutes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_logs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "employee_user_id" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "changes_made" TEXT NOT NULL,
    "time_minutes" INTEGER NOT NULL DEFAULT 0,
    "screenshot_urls" JSONB NOT NULL DEFAULT '[]',
    "client_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_projects_lead_id_idx" ON "client_projects"("lead_id");

-- CreateIndex
CREATE INDEX "client_projects_client_user_id_idx" ON "client_projects"("client_user_id");

-- CreateIndex
CREATE INDEX "client_projects_employee_user_id_idx" ON "client_projects"("employee_user_id");

-- CreateIndex
CREATE INDEX "work_logs_project_id_idx" ON "work_logs"("project_id");

-- CreateIndex
CREATE INDEX "work_logs_employee_user_id_idx" ON "work_logs"("employee_user_id");

-- AddForeignKey
ALTER TABLE "client_projects" ADD CONSTRAINT "client_projects_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_projects" ADD CONSTRAINT "client_projects_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_projects" ADD CONSTRAINT "client_projects_employee_user_id_fkey" FOREIGN KEY ("employee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_employee_user_id_fkey" FOREIGN KEY ("employee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
