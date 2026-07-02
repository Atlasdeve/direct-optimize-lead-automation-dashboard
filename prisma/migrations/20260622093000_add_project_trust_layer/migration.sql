-- CreateTable
CREATE TABLE "project_comments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "author_user_id" TEXT,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'comment',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "client_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_snapshots" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "screenshot_urls" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_reports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "week_end" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "wins" JSONB NOT NULL DEFAULT '[]',
    "next_steps" JSONB NOT NULL DEFAULT '[]',
    "total_minutes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_comments_project_id_idx" ON "project_comments"("project_id");

-- CreateIndex
CREATE INDEX "project_comments_author_user_id_idx" ON "project_comments"("author_user_id");

-- CreateIndex
CREATE INDEX "project_milestones_project_id_idx" ON "project_milestones"("project_id");

-- CreateIndex
CREATE INDEX "project_snapshots_project_id_idx" ON "project_snapshots"("project_id");

-- CreateIndex
CREATE INDEX "weekly_reports_project_id_idx" ON "weekly_reports"("project_id");

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
