-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "do_not_contact" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "outreach_approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "outreach_approved_at" TIMESTAMP(3);
