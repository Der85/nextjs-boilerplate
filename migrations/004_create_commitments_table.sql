-- ===================================================================
-- Migration 004: Create Commitments Table
-- ===================================================================
-- Commitments are intermediate containers between Outcomes and Tasks.
-- They represent specific projects or initiatives that contribute to
-- an Outcome. Every commitment must belong to exactly one outcome.
-- ===================================================================
-- Run: Supabase Dashboard > SQL Editor > New Query
-- Prerequisite: Migration 003 (outcomes table) must be run first
-- ===================================================================

-- ===================================================================
-- CREATE COMMITMENTS TABLE
-- ===================================================================

CREATE TABLE IF NOT EXISTS commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome_id uuid NOT NULL REFERENCES outcomes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===================================================================
-- INDEXES
-- ===================================================================

CREATE INDEX IF NOT EXISTS idx_commitments_user_id ON commitments(user_id);
CREATE INDEX IF NOT EXISTS idx_commitments_outcome_id ON commitments(outcome_id);
CREATE INDEX IF NOT EXISTS idx_commitments_user_status ON commitments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_commitments_outcome_status ON commitments(outcome_id, status);

-- ===================================================================
-- ROW LEVEL SECURITY
-- ===================================================================

ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own commitments" ON commitments;
CREATE POLICY "Users can view own commitments"
  ON commitments
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own commitments" ON commitments;
CREATE POLICY "Users can insert own commitments"
  ON commitments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own commitments" ON commitments;
CREATE POLICY "Users can update own commitments"
  ON commitments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own commitments" ON commitments;
CREATE POLICY "Users can delete own commitments"
  ON commitments
  FOR DELETE
  USING (auth.uid() = user_id);

-- ===================================================================
-- UPDATED_AT TRIGGER
-- ===================================================================

-- Uses the same trigger function from migration 003
DROP TRIGGER IF EXISTS update_commitments_updated_at ON commitments;
CREATE TRIGGER update_commitments_updated_at
  BEFORE UPDATE ON commitments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- COMMENTS
-- ===================================================================

COMMENT ON TABLE commitments IS 'Intermediate containers linking outcomes to tasks';
COMMENT ON COLUMN commitments.outcome_id IS 'Parent outcome this commitment contributes to';
COMMENT ON COLUMN commitments.status IS 'Current status: active, paused, completed, or archived';

-- ===================================================================
-- ROLLBACK
-- ===================================================================
-- To rollback this migration, run:
-- DROP TABLE IF EXISTS commitments CASCADE;

-- ===================================================================
-- END OF MIGRATION 004
-- ===================================================================
