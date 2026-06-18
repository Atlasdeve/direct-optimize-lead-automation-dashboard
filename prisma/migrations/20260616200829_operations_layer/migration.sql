-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "lead_checklists" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "website_checked" BOOLEAN NOT NULL DEFAULT false,
    "gbp_checked" BOOLEAN NOT NULL DEFAULT false,
    "reviews_checked" BOOLEAN NOT NULL DEFAULT false,
    "contact_form_checked" BOOLEAN NOT NULL DEFAULT false,
    "decision_maker_searched" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'New',
    "value" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "next_action_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_checklists_lead_id_key" ON "lead_checklists"("lead_id");

-- AddForeignKey
ALTER TABLE "lead_checklists" ADD CONSTRAINT "lead_checklists_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
