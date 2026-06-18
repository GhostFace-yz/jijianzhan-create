-- CreateTable
CREATE TABLE "version_counters" (
    "project_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,

    PRIMARY KEY ("project_id", "entity_type", "entity_id")
);
