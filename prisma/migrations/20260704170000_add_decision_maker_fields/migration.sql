ALTER TABLE "leads"
ADD COLUMN "decision_maker_name" TEXT,
ADD COLUMN "decision_maker_title" TEXT,
ADD COLUMN "decision_maker_source" TEXT,
ADD COLUMN "decision_maker_confidence" INTEGER;
