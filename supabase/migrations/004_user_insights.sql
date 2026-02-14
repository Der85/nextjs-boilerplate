-- ============================
-- User Insights (Sherlock Engine)
-- Idempotent migration - safe to run multiple times
-- ============================

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'correlation',
  title text NOT NULL,
  message text NOT NULL,
  icon text DEFAULT '🔍',
  is_dismissed boolean DEFAULT false,
  is_helpful boolean,
  data_window_start date,
  data_window_end date,
  created_at timestamptz DEFAULT now()
);

-- Add category-specific columns if they don't exist
ALTER TABLE user_insights ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE user_insights ADD COLUMN IF NOT EXISTS category_color text;

-- Update type constraint to include 'category' type (drop and recreate)
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_insights_type_check') THEN
    ALTER TABLE user_insights DROP CONSTRAINT user_insights_type_check;
  END IF;
  -- Add updated constraint
  ALTER TABLE user_insights ADD CONSTRAINT user_insights_type_check
    CHECK (type IN ('correlation', 'streak', 'warning', 'praise', 'category'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN user_insights.type IS 'correlation=cross-day patterns, streak=positive streaks, warning=gentle alerts, praise=encouragement, category=life-area patterns';
COMMENT ON COLUMN user_insights.category_id IS 'For category-type insights, the primary category being discussed';
COMMENT ON COLUMN user_insights.category_color IS 'Cached category color for UI accent (in case category is deleted)';

ALTER TABLE user_insights ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$
BEGIN
  CREATE POLICY "Users can read own insights" ON user_insights FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own insights" ON user_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own insights" ON user_insights FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can delete own insights" ON user_insights FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_insights_user_created ON user_insights(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_insights_user_type ON user_insights(user_id, type, created_at DESC)
  WHERE is_dismissed = false;
