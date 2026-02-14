-- ============================
-- Life Balance Scores
-- Gamification layer for priority-task alignment
-- Idempotent migration - safe to run multiple times
-- ============================

-- Create balance_scores table
CREATE TABLE IF NOT EXISTS balance_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  breakdown jsonb NOT NULL, -- per-domain scores: [{ domain, score, weight, taskCount, completionRate, categoryIcon, categoryColor }]
  computed_for_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, computed_for_date)
);

COMMENT ON TABLE balance_scores IS 'Daily life balance scores showing alignment between tasks and stated priorities';
COMMENT ON COLUMN balance_scores.score IS 'Overall balance score 0-100';
COMMENT ON COLUMN balance_scores.breakdown IS 'Per-domain breakdown with score, weight, taskCount, completionRate';
COMMENT ON COLUMN balance_scores.computed_for_date IS 'The date this score represents (one score per day)';

-- Enable RLS
ALTER TABLE balance_scores ENABLE ROW LEVEL SECURITY;

-- RLS policies - users own their scores
DO $$
BEGIN
  CREATE POLICY "Users can read own balance scores" ON balance_scores
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own balance scores" ON balance_scores
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own balance scores" ON balance_scores
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can delete own balance scores" ON balance_scores
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_balance_scores_user_date
  ON balance_scores(user_id, computed_for_date DESC);

CREATE INDEX IF NOT EXISTS idx_balance_scores_user_recent
  ON balance_scores(user_id, created_at DESC)
  WHERE computed_for_date >= CURRENT_DATE - INTERVAL '30 days';
