-- ============================
-- AI Weekly Review Copilot
-- Generates summaries of weekly task activity and progress
-- Idempotent migration - safe to run multiple times
-- ============================

-- Create weekly_reviews table
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL, -- Monday of the review week
  week_end date NOT NULL, -- Sunday of the review week

  -- AI-generated content
  summary_markdown text NOT NULL, -- the full review as markdown
  wins text[] NOT NULL DEFAULT '{}', -- array of win statements
  gaps text[] NOT NULL DEFAULT '{}', -- array of gap observations
  patterns text[] NOT NULL DEFAULT '{}', -- array of pattern observations
  suggested_focus text[] NOT NULL DEFAULT '{}', -- suggested focus for next week

  -- Stats snapshot
  tasks_completed integer NOT NULL DEFAULT 0,
  tasks_created integer NOT NULL DEFAULT 0,
  tasks_dropped integer NOT NULL DEFAULT 0,
  tasks_rescheduled integer NOT NULL DEFAULT 0,
  completion_rate float NOT NULL DEFAULT 0,
  balance_score_avg integer, -- average balance score for the week
  balance_score_trend text CHECK (balance_score_trend IN ('improving', 'declining', 'stable')),
  top_category text, -- most active category
  neglected_categories text[] DEFAULT '{}', -- high-priority categories with low activity

  -- User interaction
  user_reflection text, -- optional user notes added after review
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,

  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start)
);

COMMENT ON TABLE weekly_reviews IS 'AI-generated weekly reviews summarizing task activity and progress';
COMMENT ON COLUMN weekly_reviews.week_start IS 'Monday of the review week';
COMMENT ON COLUMN weekly_reviews.week_end IS 'Sunday of the review week';
COMMENT ON COLUMN weekly_reviews.summary_markdown IS 'Full AI-generated review in markdown format';
COMMENT ON COLUMN weekly_reviews.wins IS 'Array of positive achievements from the week';
COMMENT ON COLUMN weekly_reviews.gaps IS 'Array of areas that need attention, framed gently';
COMMENT ON COLUMN weekly_reviews.patterns IS 'Array of behavioral patterns noticed';
COMMENT ON COLUMN weekly_reviews.suggested_focus IS 'Actionable suggestions for next week';
COMMENT ON COLUMN weekly_reviews.user_reflection IS 'Optional user notes added after reading the review';

-- Enable RLS
ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies - users own their reviews
DO $$
BEGIN
  CREATE POLICY "Users can read own weekly reviews" ON weekly_reviews
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own weekly reviews" ON weekly_reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own weekly reviews" ON weekly_reviews
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can delete own weekly reviews" ON weekly_reviews
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_week
  ON weekly_reviews(user_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_reviews_recent
  ON weekly_reviews(user_id, created_at DESC)
  WHERE created_at >= CURRENT_DATE - INTERVAL '90 days';
