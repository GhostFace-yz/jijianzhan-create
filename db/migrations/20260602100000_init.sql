-- Migration: Initial schema for AI Chat Web MVP
-- Created: 2026-06-02
-- Tech stack: PostgreSQL 16 + Prisma

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT UNIQUE,
    "phone" TEXT UNIQUE,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- Refresh tokens table (for JWT revocation & device limit)
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_jti" TEXT NOT NULL UNIQUE,
    "device_fingerprint" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- Sessions table (chat sessions)
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '新对话',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sessions_status_check" CHECK ("status" IN ('ACTIVE', 'ARCHIVED'))
);

CREATE INDEX "sessions_user_id_updated_at_idx" ON "sessions"("user_id", "updated_at" DESC);
CREATE INDEX "sessions_deleted_at_idx" ON "sessions"("deleted_at");

-- Messages table
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "attachments" JSONB DEFAULT '[]',
    "generated_media" JSONB DEFAULT '[]',
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_role_check" CHECK ("role" IN ('USER', 'ASSISTANT', 'SYSTEM')),
    CONSTRAINT "messages_type_check" CHECK ("type" IN ('TEXT', 'IMAGE_GEN', 'VIDEO_GEN'))
);

CREATE INDEX "messages_session_id_created_at_idx" ON "messages"("session_id", "created_at" ASC);

-- Generation tasks table (async image/video generation)
CREATE TABLE "generation_tasks" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider_task_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result_url" TEXT,
    "params" JSONB,
    "error_message" TEXT,
    "progress" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_tasks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "generation_tasks_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "generation_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "generation_tasks_type_check" CHECK ("type" IN ('IMAGE', 'VIDEO')),
    CONSTRAINT "generation_tasks_status_check" CHECK ("status" IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'))
);

CREATE INDEX "generation_tasks_user_id_status_idx" ON "generation_tasks"("user_id", "status");
CREATE INDEX "generation_tasks_message_id_idx" ON "generation_tasks"("message_id");
CREATE INDEX "generation_tasks_provider_task_id_idx" ON "generation_tasks"("provider_task_id");

-- Subscription plans table
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "price_monthly" INTEGER NOT NULL,
    "price_yearly" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "quota_limits" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscription_plans_tier_check" CHECK ("tier" IN ('FREE', 'BASIC', 'PRO'))
);

-- Subscriptions table
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "usage_quota" INTEGER NOT NULL,
    "usage_consumed" INTEGER NOT NULL DEFAULT 0,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "subscriptions_status_check" CHECK ("status" IN ('ACTIVE', 'CANCELLED', 'EXPIRED'))
);

CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- Bills table
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bills_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bills_status_check" CHECK ("status" IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED'))
);

CREATE INDEX "bills_user_id_created_at_idx" ON "bills"("user_id", "created_at" DESC);

-- Seed default subscription plans
INSERT INTO "subscription_plans" ("id", "name", "tier", "price_monthly", "price_yearly", "features", "quota_limits", "updated_at")
VALUES
    ('plan_free', '免费试用', 'FREE', 0, 0, '{"text_chats": -1, "image_gens": 10, "video_gens": 3, "support": false}'::jsonb, '{"text_chats": -1, "image_gens": 10, "video_gens": 3}'::jsonb, CURRENT_TIMESTAMP),
    ('plan_basic', '基础版', 'BASIC', 2900, 29000, '{"text_chats": -1, "image_gens": 100, "video_gens": 20, "support": true}'::jsonb, '{"text_chats": -1, "image_gens": 100, "video_gens": 20}'::jsonb, CURRENT_TIMESTAMP),
    ('plan_pro', '专业版', 'PRO', 9900, 99000, '{"text_chats": -1, "image_gens": 500, "video_gens": 100, "support": true, "priority": true}'::jsonb, '{"text_chats": -1, "image_gens": 500, "video_gens": 100}'::jsonb, CURRENT_TIMESTAMP);
