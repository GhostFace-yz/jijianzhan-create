-- CreateTable
CREATE TABLE "version_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "version_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "parent_version_number" INTEGER,
    "diff" JSONB NOT NULL,
    "edited_by" TEXT,
    "ai_model" JSONB,
    "prompt_override" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "version_snapshots_project_id_entity_type_entity_id_version_number_idx" ON "version_snapshots"("project_id", "entity_type", "entity_id", "version_number" DESC);

-- CreateIndex
CREATE INDEX "version_snapshots_project_id_entity_type_entity_id_created_at_idx" ON "version_snapshots"("project_id", "entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "version_snapshots_project_id_entity_type_entity_id_version_number_key" ON "version_snapshots"("project_id", "entity_type", "entity_id", "version_number");
