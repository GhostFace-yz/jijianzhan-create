-- CreateTable
CREATE TABLE "downstream_review_flags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "source_entity_type" TEXT NOT NULL,
    "source_entity_id" TEXT NOT NULL,
    "source_version_id" TEXT NOT NULL,
    "new_version_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "downstream_review_flags_project_id_source_entity_type_source_entity_id_idx" ON "downstream_review_flags"("project_id", "source_entity_type", "source_entity_id");

-- CreateIndex
CREATE INDEX "downstream_review_flags_status_idx" ON "downstream_review_flags"("status");
