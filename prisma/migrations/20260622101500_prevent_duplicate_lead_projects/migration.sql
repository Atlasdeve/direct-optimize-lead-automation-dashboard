-- Detach duplicate project rows from the same lead, keeping the oldest linked project.
WITH ranked AS (
  SELECT
    id,
    lead_id,
    ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY created_at ASC, id ASC) AS rn
  FROM "client_projects"
  WHERE lead_id IS NOT NULL
)
UPDATE "client_projects"
SET lead_id = NULL,
    notes = CONCAT(COALESCE(notes, ''), CASE WHEN COALESCE(notes, '') = '' THEN '' ELSE E'\n\n' END, 'Detached from lead because another client project already exists for that lead.')
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- PostgreSQL allows multiple NULLs, so this prevents duplicates only for linked lead projects.
CREATE UNIQUE INDEX "client_projects_lead_id_unique_not_null" ON "client_projects"("lead_id") WHERE "lead_id" IS NOT NULL;
