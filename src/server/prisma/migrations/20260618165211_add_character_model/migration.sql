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
    "ref_images" JSONB NOT NULL DEFAULT [],
    "ip_adapter_id" TEXT,
    "lora_path" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "characters_project_id_idx" ON "characters"("project_id");
