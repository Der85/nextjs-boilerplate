-- ============================================
-- Migration: User Insights (Pattern Engine)
-- Stores AI-generated correlations from the Insight Generator
-- so we don't re-generate on every dashboard load.
-- ============================================

-- Step 1: Create the user_insights table
CREATE TABLE IF NOT EXISTS user_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL DEFAULT 'correlation',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  icon VARCHAR(10) NOT NULL DEFAULT '🔍',
  data_window_start DATE,
  data_window_end DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 2: Index for quick lookup of latest insight per user
CREATE INDEX IF NOT EXISTS idx_user_insights_user_created
  ON user_insights(user_id, created_at DESC);

-- Step 3: Row Level Security
ALTER TABLE user_insights ENABLE ROW LEVEL SECURITY;

-- Users can only read their own insights
CREATE POLICY "Users can read own insights"
  ON user_insights FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own insights (via API)
CREATE POLICY "Users can insert own insights"
  ON user_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for API route using service client)
CREATE POLICY "Service role full access"
  ON user_insights FOR ALL
  USING (true)
  WITH CHECK (true);
