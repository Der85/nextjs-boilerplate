-- ===================================================================
-- Migration 003: Create Outcomes Table
-- ===================================================================
-- Outcomes represent higher-level objectives with time horizons
-- (weekly, monthly, quarterly). They provide the "why" behind tasks.
-- ===================================================================
-- Run: Supabase Dashboard > SQL Editor > New Query
-- ===================================================================

-- ===================================================================
-- CREATE OUTCOMES TABLE
-- ===================================================================

CREATE TABLE IF NOT EXISTS outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  horizon text NOT NULL CHECK (horizon IN ('weekly', 'monthly', 'quarterly')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  priority_rank integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===================================================================
-- INDEXES
-- ===================================================================

CREATE INDEX IF NOT EXISTS idx_outcomes_user_id ON outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_user_status ON outcomes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_outcomes_user_horizon ON outcomes(user_id, horizon);
CREATE INDEX IF NOT EXISTS idx_outcomes_priority ON outcomes(user_id, priority_rank);

-- ===================================================================
-- ROW LEVEL SECURITY
-- ===================================================================

ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own outcomes" ON outcomes;
CREATE POLICY "Users can view own outcomes"
  ON outcomes
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own outcomes" ON outcomes;
CREATE POLICY "Users can insert own outcomes"
  ON outcomes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own outcomes" ON outcomes;
CREATE POLICY "Users can update own outcomes"
  ON outcomes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own outcomes" ON outcomes;
CREATE POLICY "Users can delete own outcomes"
  ON outcomes
  FOR DELETE
  USING (auth.uid() = user_id);

-- ===================================================================
-- UPDATED_AT TRIGGER
-- ===================================================================

-- Create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_outcomes_updated_at ON outcomes;
CREATE TRIGGER update_outcomes_updated_at
  BEFORE UPDATE ON outcomes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- COMMENTS
-- ===================================================================

COMMENT ON TABLE outcomes IS 'High-level objectives with time horizons (weekly/monthly/quarterly)';
COMMENT ON COLUMN outcomes.horizon IS 'Time horizon: weekly, monthly, or quarterly';
COMMENT ON COLUMN outcomes.status IS 'Current status: active, paused, completed, or archived';
COMMENT ON COLUMN outcomes.priority_rank IS 'Lower numbers = higher priority. Default 0.';

-- ===================================================================
-- ROLLBACK
-- ===================================================================
-- To rollback this migration, run:
-- DROP TABLE IF EXISTS outcomes CASCADE;

-- ===================================================================
-- END OF MIGRATION 003
-- ===================================================================
