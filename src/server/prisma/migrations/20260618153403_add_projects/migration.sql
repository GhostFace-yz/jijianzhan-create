-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL DEFAULT 'system',
    "team_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "meta" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "projects_user_id_updated_at_idx" ON "projects"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");
