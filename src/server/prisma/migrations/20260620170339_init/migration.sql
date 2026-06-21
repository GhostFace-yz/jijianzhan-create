-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role_type" TEXT NOT NULL,
    "episode_range" TEXT,
    "appearance" TEXT,
    "costume" TEXT,
    "expression" TEXT,
    "signature_action" TEXT,
    "voice_description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ref_images" JSONB NOT NULL,
    "ip_adapter_id" TEXT,
    "lora_path" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
    "key_props" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "base_seed" INTEGER,
    "base_image_url" TEXT,
    "variants" JSONB NOT NULL DEFAULT [],
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL DEFAULT 'system',
    "team_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "meta" JSONB NOT NULL,
    "outline" JSONB,
    "outline_locked" BOOLEAN NOT NULL DEFAULT false,
    "storyboard_nodes" JSONB,
    "music" JSONB,
    "render_output" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "version_counters" (
    "project_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("project_id", "entity_type", "entity_id")
);

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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "characters_project_id_idx" ON "characters"("project_id");

-- CreateIndex
CREATE INDEX "downstream_review_flags_status_idx" ON "downstream_review_flags"("status");

-- CreateIndex
CREATE INDEX "downstream_review_flags_project_id_source_entity_type_source_entity_id_idx" ON "downstream_review_flags"("project_id", "source_entity_type", "source_entity_id");

-- CreateIndex
CREATE INDEX "locations_project_id_idx" ON "locations"("project_id");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_user_id_updated_at_idx" ON "projects"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "version_snapshots_project_id_entity_type_entity_id_created_at_idx" ON "version_snapshots"("project_id", "entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "version_snapshots_project_id_entity_type_entity_id_version_number_idx" ON "version_snapshots"("project_id", "entity_type", "entity_id", "version_number" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "version_snapshots_project_id_entity_type_entity_id_version_number_key" ON "version_snapshots"("project_id", "entity_type", "entity_id", "version_number");
