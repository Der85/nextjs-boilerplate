-- ===================================================================
-- Migration 005: Extend focus_plans with Outcome Linking
-- ===================================================================
-- Adds outcome_id and commitment_id columns to focus_plans table.
-- This enables linking tasks to outcomes directly or via commitments.
-- ===================================================================
-- Run: Supabase Dashboard > SQL Editor > New Query
-- Prerequisites: Migrations 003-004 must be run first
-- ===================================================================

-- ===================================================================
-- ADD NEW COLUMNS
-- ===================================================================

-- Add outcome_id foreign key (nullable for backward compatibility)
ALTER TABLE focus_plans
ADD COLUMN IF NOT EXISTS outcome_id uuid REFERENCES outcomes(id) ON DELETE SET NULL;

-- Add commitment_id foreign key (nullable)
ALTER TABLE focus_plans
ADD COLUMN IF NOT EXISTS commitment_id uuid REFERENCES commitments(id) ON DELETE SET NULL;

-- ===================================================================
-- INDEXES FOR EFFICIENT QUERYING
-- ===================================================================

-- Index for finding tasks by outcome
CREATE INDEX IF NOT EXISTS idx_focus_plans_outcome_id
  ON focus_plans(outcome_id)
  WHERE outcome_id IS NOT NULL;

-- Index for finding tasks by commitment
CREATE INDEX IF NOT EXISTS idx_focus_plans_commitment_id
  ON focus_plans(commitment_id)
  WHERE commitment_id IS NOT NULL;

-- Index for finding unlinked tasks that need linking
CREATE INDEX IF NOT EXISTS idx_focus_plans_needs_linking
  ON focus_plans(user_id, status)
  WHERE status = 'needs_linking';

-- Composite index for outcome detail page queries
CREATE INDEX IF NOT EXISTS idx_focus_plans_outcome_status
  ON focus_plans(outcome_id, status)
  WHERE outcome_id IS NOT NULL;

-- ===================================================================
-- COMMENTS
-- ===================================================================

COMMENT ON COLUMN focus_plans.outcome_id IS 'Links task directly to an outcome (optional if commitment_id is set)';
COMMENT ON COLUMN focus_plans.commitment_id IS 'Links task to a commitment (which belongs to an outcome)';

-- ===================================================================
-- VALIDATION NOTES
-- ===================================================================
-- The constraint "active tasks must have outcome_id OR commitment_id"
-- is enforced at the application level for:
-- 1. Better error messages to users
-- 2. Flexibility during backfill migration
-- 3. Allowing legacy data to exist without breaking
--
-- Business rule:
-- - status IN ('active') requires outcome_id IS NOT NULL OR commitment_id IS NOT NULL
-- - status = 'needs_linking' indicates task needs parent before becoming active
-- - completed/parked tasks retain their links but don't require them

-- ===================================================================
-- ROLLBACK
-- ===================================================================
-- To rollback this migration, run:
-- DROP INDEX IF EXISTS idx_focus_plans_outcome_id;
-- DROP INDEX IF EXISTS idx_focus_plans_commitment_id;
-- DROP INDEX IF EXISTS idx_focus_plans_needs_linking;
-- DROP INDEX IF EXISTS idx_focus_plans_outcome_status;
-- ALTER TABLE focus_plans DROP COLUMN IF EXISTS outcome_id;
-- ALTER TABLE focus_plans DROP COLUMN IF EXISTS commitment_id;

-- ===================================================================
-- END OF MIGRATION 005
-- ===================================================================
