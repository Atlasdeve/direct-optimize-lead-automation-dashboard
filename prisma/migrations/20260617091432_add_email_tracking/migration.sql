-- AlterTable
ALTER TABLE "outreach_logs" ADD COLUMN     "click_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "clicked_at" TIMESTAMP(3),
ADD COLUMN     "last_clicked_at" TIMESTAMP(3),
ADD COLUMN     "last_opened_at" TIMESTAMP(3),
ADD COLUMN     "open_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "opened_at" TIMESTAMP(3);
