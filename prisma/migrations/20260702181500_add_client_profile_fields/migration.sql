ALTER TABLE "users" ADD COLUMN "phone" TEXT;

ALTER TABLE "client_projects"
ADD COLUMN "additional_website_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "additional_gmb_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
