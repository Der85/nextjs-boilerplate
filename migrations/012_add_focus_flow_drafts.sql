-- ===================================================================
-- Migration 012: Add Focus Flow Draft Support
-- ===================================================================
-- Adds draft_data column to focus_plans for persisting Focus Mode
-- flow state across page refreshes. Enables resume capability.
-- ===================================================================
-- Run: Supabase Dashboard > SQL Editor > New Query
-- ===================================================================

-- ===================================================================
-- ADD DRAFT_DATA COLUMN
-- ===================================================================

-- Add draft_data column to store focus flow state as JSON
-- This column holds the entire flow state: parsed tasks, context, etc.
ALTER TABLE focus_plans
ADD COLUMN IF NOT EXISTS draft_data jsonb;

-- ===================================================================
-- ADD IS_DRAFT FLAG
-- ===================================================================

-- Add a boolean flag to easily identify draft entries
-- (Simpler than relying on status column which may have other meanings)
ALTER TABLE focus_plans
ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT false;

-- ===================================================================
-- INDEXES
-- ===================================================================

-- Index for quickly finding user's draft
-- Only one draft per user should exist at a time
CREATE INDEX IF NOT EXISTS idx_focus_plans_user_draft
  ON focus_plans(user_id)
  WHERE is_draft = true;

-- ===================================================================
-- CONSTRAINT
-- ===================================================================

-- Ensure only one draft per user (using a unique partial index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_plans_one_draft_per_user
  ON focus_plans(user_id)
  WHERE is_draft = true;

-- ===================================================================
-- COMMENTS
-- ===================================================================

COMMENT ON COLUMN focus_plans.draft_data IS 'JSON blob containing focus flow state (parsed tasks, context, breakdowns) for resuming after page refresh';
COMMENT ON COLUMN focus_plans.is_draft IS 'True if this is a draft entry for resuming focus flow, false for completed plans';

-- ===================================================================
-- ROLLBACK
-- ===================================================================
-- To rollback this migration, run:
-- DROP INDEX IF EXISTS idx_focus_plans_user_draft;
-- DROP INDEX IF EXISTS idx_focus_plans_one_draft_per_user;
-- ALTER TABLE focus_plans DROP COLUMN IF EXISTS draft_data;
-- ALTER TABLE focus_plans DROP COLUMN IF EXISTS is_draft;

-- ===================================================================
-- END OF MIGRATION 012
-- ===================================================================
