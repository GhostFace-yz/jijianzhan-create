-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT,
    "space_type" TEXT,
    "style" TEXT,
    "color_tone" TEXT,
    "lighting_type" TEXT,
    "key_props" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "base_seed" INTEGER,
    "base_image_url" TEXT,
    "variants" JSONB NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "locations_project_id_idx" ON "locations"("project_id");
