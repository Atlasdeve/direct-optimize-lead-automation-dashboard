CREATE TABLE "adult_lead_countries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adult_lead_countries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "adult_lead_countries_name_key" ON "adult_lead_countries"("name");
