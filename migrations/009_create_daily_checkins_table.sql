-- ===================================================================
-- Migration 009: Daily State Check-ins for Adaptive UX
-- ===================================================================
-- Run this migration after 008_create_now_mode.sql
-- Go to: Supabase Dashboard > SQL Editor > New Query
-- ===================================================================

-- ===================================================================
-- PART 1: Create daily_checkins table
-- ===================================================================

CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  overwhelm INTEGER NOT NULL CHECK (overwhelm >= 1 AND overwhelm <= 5),
  anxiety INTEGER NOT NULL CHECK (anxiety >= 1 AND anxiety <= 5),
  energy INTEGER NOT NULL CHECK (energy >= 1 AND energy <= 5),
  clarity INTEGER NOT NULL CHECK (clarity >= 1 AND clarity <= 5),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure one check-in per user per day
  CONSTRAINT unique_user_daily_checkin UNIQUE (user_id, date)
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_id
ON daily_checkins(user_id);

CREATE INDEX IF NOT EXISTS idx_daily_checkins_date
ON daily_checkins(user_id, date DESC);

-- Note: Partial indexes with CURRENT_DATE are not allowed (non-immutable function)
-- The composite index above handles recent queries efficiently

-- Add comments
COMMENT ON TABLE daily_checkins IS 'Daily state check-ins tracking overwhelm, anxiety, energy, and clarity for adaptive UX';
COMMENT ON COLUMN daily_checkins.overwhelm IS 'Overwhelm level 1-5: 1=Calm, 5=Overwhelmed';
COMMENT ON COLUMN daily_checkins.anxiety IS 'Anxiety level 1-5: 1=Relaxed, 5=Anxious';
COMMENT ON COLUMN daily_checkins.energy IS 'Energy level 1-5: 1=Exhausted, 5=Energized';
COMMENT ON COLUMN daily_checkins.clarity IS 'Mental clarity 1-5: 1=Foggy, 5=Clear';

-- ===================================================================
-- PART 2: Add RLS policies
-- ===================================================================

ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own check-ins"
  ON daily_checkins
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own check-ins"
  ON daily_checkins
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own check-ins"
  ON daily_checkins
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ===================================================================
-- PART 3: Create trigger for updated_at
-- ===================================================================

CREATE OR REPLACE FUNCTION update_daily_checkins_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_daily_checkins_updated_at ON daily_checkins;
CREATE TRIGGER update_daily_checkins_updated_at
  BEFORE UPDATE ON daily_checkins
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_checkins_timestamp();

-- ===================================================================
-- PART 4: Create analytics events table for adaptive mode
-- ===================================================================

CREATE TABLE IF NOT EXISTS adaptive_mode_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'daily_checkin_submitted',
    'adaptive_mode_triggered',
    'simplified_ui_enabled',
    'state_based_recommendation_shown',
    'state_based_recommendation_accepted',
    'state_based_recommendation_dismissed'
  )),
  trigger_reason TEXT, -- e.g., 'high_overwhelm', 'low_energy', 'low_clarity'
  checkin_id UUID REFERENCES daily_checkins(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies for events
ALTER TABLE adaptive_mode_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own adaptive events"
  ON adaptive_mode_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own adaptive events"
  ON adaptive_mode_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_adaptive_mode_events_user_id
ON adaptive_mode_events(user_id);

CREATE INDEX IF NOT EXISTS idx_adaptive_mode_events_created_at
ON adaptive_mode_events(created_at DESC);

-- ===================================================================
-- PART 5: Helper function to get latest check-in
-- ===================================================================

CREATE OR REPLACE FUNCTION get_latest_daily_checkin(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  date DATE,
  overwhelm INTEGER,
  anxiety INTEGER,
  energy INTEGER,
  clarity INTEGER,
  note TEXT,
  is_today BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.date,
    dc.overwhelm,
    dc.anxiety,
    dc.energy,
    dc.clarity,
    dc.note,
    dc.date = CURRENT_DATE AS is_today
  FROM daily_checkins dc
  WHERE dc.user_id = p_user_id
  ORDER BY dc.date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- PART 6: Helper function to get week trend
-- ===================================================================

CREATE OR REPLACE FUNCTION get_weekly_checkin_trend(p_user_id UUID)
RETURNS TABLE (
  date DATE,
  overwhelm INTEGER,
  anxiety INTEGER,
  energy INTEGER,
  clarity INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.date,
    dc.overwhelm,
    dc.anxiety,
    dc.energy,
    dc.clarity
  FROM daily_checkins dc
  WHERE dc.user_id = p_user_id
    AND dc.date >= CURRENT_DATE - INTERVAL '7 days'
  ORDER BY dc.date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- PART 7: Helper function for correlation insights
-- ===================================================================

CREATE OR REPLACE FUNCTION get_checkin_correlations(p_user_id UUID)
RETURNS TABLE (
  high_overwhelm_avg_untriaged NUMERIC,
  low_overwhelm_avg_untriaged NUMERIC,
  high_energy_tasks_completed NUMERIC,
  low_energy_tasks_completed NUMERIC,
  total_checkins INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH checkin_stats AS (
    SELECT
      dc.date,
      dc.overwhelm,
      dc.energy,
      (
        SELECT COUNT(*)::NUMERIC
        FROM inbox_items ii
        WHERE ii.user_id = p_user_id
          AND ii.triage_status = 'pending'
          AND DATE(ii.captured_at) <= dc.date
      ) as untriaged_count,
      (
        SELECT COUNT(*)::NUMERIC
        FROM focus_plans fp
        WHERE fp.user_id = p_user_id
          AND fp.status = 'completed'
          AND DATE(fp.updated_at) = dc.date
      ) as completed_count
    FROM daily_checkins dc
    WHERE dc.user_id = p_user_id
      AND dc.date >= CURRENT_DATE - INTERVAL '30 days'
  )
  SELECT
    AVG(CASE WHEN overwhelm >= 4 THEN untriaged_count END) as high_overwhelm_avg_untriaged,
    AVG(CASE WHEN overwhelm <= 2 THEN untriaged_count END) as low_overwhelm_avg_untriaged,
    AVG(CASE WHEN energy >= 4 THEN completed_count END) as high_energy_tasks_completed,
    AVG(CASE WHEN energy <= 2 THEN completed_count END) as low_energy_tasks_completed,
    COUNT(*)::INTEGER as total_checkins
  FROM checkin_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Check daily_checkins table
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'daily_checkins';

-- Check adaptive_mode_events table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'adaptive_mode_events';

-- ===================================================================
-- ROLLBACK (if needed)
-- ===================================================================
-- Uncomment and run these if you need to undo the migration

-- DROP FUNCTION IF EXISTS get_checkin_correlations(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS get_weekly_checkin_trend(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS get_latest_daily_checkin(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS update_daily_checkins_timestamp() CASCADE;
-- DROP TABLE IF EXISTS adaptive_mode_events CASCADE;
-- DROP TABLE IF EXISTS daily_checkins CASCADE;

-- ===================================================================
-- END OF MIGRATION
-- ===================================================================
