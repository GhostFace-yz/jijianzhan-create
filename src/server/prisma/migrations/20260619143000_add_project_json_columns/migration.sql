-- Add JSON columns to projects for episode-level storyboard, music, and render output storage
ALTER TABLE "projects" ADD COLUMN "storyboard_nodes" JSONB;
ALTER TABLE "projects" ADD COLUMN "music" JSONB;
ALTER TABLE "projects" ADD COLUMN "render_output" JSONB;
