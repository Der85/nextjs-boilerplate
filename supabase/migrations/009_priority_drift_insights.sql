-- ============================
-- Priority Drift Insights Support
-- Extends Sherlock Engine with priority alignment analysis
-- Idempotent migration - safe to run multiple times
-- ============================

-- Add priority_rank column for priority_drift insights
ALTER TABLE user_insights ADD COLUMN IF NOT EXISTS priority_rank integer;

COMMENT ON COLUMN user_insights.priority_rank IS 'For priority_drift insights, the rank of the priority being discussed (1-8)';

-- Update type constraint to include 'priority_drift'
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_insights_type_check') THEN
    ALTER TABLE user_insights DROP CONSTRAINT user_insights_type_check;
  END IF;
  -- Add updated constraint with priority_drift
  ALTER TABLE user_insights ADD CONSTRAINT user_insights_type_check
    CHECK (type IN ('correlation', 'streak', 'warning', 'praise', 'category', 'priority_drift'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Update comment to include new type
COMMENT ON COLUMN user_insights.type IS 'correlation=cross-day patterns, streak=positive streaks, warning=gentle alerts, praise=encouragement, category=life-area patterns, priority_drift=priority alignment gaps';
