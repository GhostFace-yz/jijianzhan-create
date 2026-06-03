-- Down migration: Drop all tables
-- WARNING: This will delete all data

DROP TABLE IF EXISTS "bills" CASCADE;
DROP TABLE IF EXISTS "subscriptions" CASCADE;
DROP TABLE IF EXISTS "subscription_plans" CASCADE;
DROP TABLE IF EXISTS "generation_tasks" CASCADE;
DROP TABLE IF EXISTS "messages" CASCADE;
DROP TABLE IF EXISTS "sessions" CASCADE;
DROP TABLE IF EXISTS "refresh_tokens" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

DROP TYPE IF EXISTS "SessionStatus";
DROP TYPE IF EXISTS "MessageRole";
DROP TYPE IF EXISTS "MessageType";
DROP TYPE IF EXISTS "GenerationType";
DROP TYPE IF EXISTS "GenerationStatus";
DROP TYPE IF EXISTS "PlanTier";
DROP TYPE IF EXISTS "SubscriptionStatus";
DROP TYPE IF EXISTS "BillStatus";
