-- ===================================================================
-- Migration 010: Weekly Planning Ritual
-- ===================================================================
-- Run this migration after 009_create_daily_checkins_table.sql
-- Go to: Supabase Dashboard > SQL Editor > New Query
-- ===================================================================

-- ===================================================================
-- PART 1: Create weekly_plans table
-- ===================================================================

CREATE TABLE IF NOT EXISTS weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ISO week number (1-53) and year
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  -- Version tracking for plan revisions
  version INTEGER NOT NULL DEFAULT 1,
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'committed', 'completed', 'abandoned')),
  -- Capacity planning (in minutes)
  available_capacity_minutes INTEGER NOT NULL DEFAULT 480, -- Default 8 hours
  planned_capacity_minutes INTEGER NOT NULL DEFAULT 0,
  -- Previous week review
  previous_week_reflection TEXT,
  wins TEXT[], -- Array of wins from previous week
  learnings TEXT[], -- Array of learnings
  -- Plan summary (generated at commit)
  summary_markdown TEXT,
  -- Timestamps
  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure one active plan per user per week (can have multiple versions)
  CONSTRAINT unique_user_week_version UNIQUE (user_id, year, week_number, version)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_weekly_plans_user_id
ON weekly_plans(user_id);

CREATE INDEX IF NOT EXISTS idx_weekly_plans_week
ON weekly_plans(user_id, year DESC, week_number DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_plans_status
ON weekly_plans(user_id, status);

-- Add comments
COMMENT ON TABLE weekly_plans IS 'Weekly planning ritual plans with version history';
COMMENT ON COLUMN weekly_plans.week_number IS 'ISO week number (1-53)';
COMMENT ON COLUMN weekly_plans.version IS 'Version number for plan revisions within same week';
COMMENT ON COLUMN weekly_plans.available_capacity_minutes IS 'User-specified available time for the week';
COMMENT ON COLUMN weekly_plans.planned_capacity_minutes IS 'Sum of estimated minutes for planned tasks';

-- ===================================================================
-- PART 2: Create weekly_plan_outcomes table
-- ===================================================================

CREATE TABLE IF NOT EXISTS weekly_plan_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_plan_id UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  outcome_id UUID NOT NULL REFERENCES outcomes(id) ON DELETE CASCADE,
  priority_rank INTEGER NOT NULL DEFAULT 0, -- 1 = top priority, max 3 selected
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each outcome can only be added once per plan
  CONSTRAINT unique_plan_outcome UNIQUE (weekly_plan_id, outcome_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_weekly_plan_outcomes_plan_id
ON weekly_plan_outcomes(weekly_plan_id);

CREATE INDEX IF NOT EXISTS idx_weekly_plan_outcomes_outcome_id
ON weekly_plan_outcomes(outcome_id);

COMMENT ON TABLE weekly_plan_outcomes IS 'Selected outcomes for a weekly plan (max 3)';

-- ===================================================================
-- PART 3: Create weekly_plan_tasks table
-- ===================================================================

CREATE TABLE IF NOT EXISTS weekly_plan_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_plan_id UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES focus_plans(id) ON DELETE CASCADE,
  scheduled_day INTEGER CHECK (scheduled_day >= 0 AND scheduled_day <= 6), -- 0 = Monday, 6 = Sunday, NULL = unscheduled
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  priority_rank INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each task can only be added once per plan
  CONSTRAINT unique_plan_task UNIQUE (weekly_plan_id, task_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_weekly_plan_tasks_plan_id
ON weekly_plan_tasks(weekly_plan_id);

CREATE INDEX IF NOT EXISTS idx_weekly_plan_tasks_task_id
ON weekly_plan_tasks(task_id);

CREATE INDEX IF NOT EXISTS idx_weekly_plan_tasks_day
ON weekly_plan_tasks(weekly_plan_id, scheduled_day);

COMMENT ON TABLE weekly_plan_tasks IS 'Tasks included in a weekly plan with scheduling';
COMMENT ON COLUMN weekly_plan_tasks.scheduled_day IS '0 = Monday, 6 = Sunday, NULL = flexible';

-- ===================================================================
-- PART 4: Add RLS policies
-- ===================================================================

ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plan_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plan_tasks ENABLE ROW LEVEL SECURITY;

-- Weekly plans policies
CREATE POLICY "Users can view their own weekly plans"
  ON weekly_plans
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own weekly plans"
  ON weekly_plans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekly plans"
  ON weekly_plans
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weekly plans"
  ON weekly_plans
  FOR DELETE
  USING (auth.uid() = user_id);

-- Weekly plan outcomes policies (via join to weekly_plans)
CREATE POLICY "Users can view their weekly plan outcomes"
  ON weekly_plan_outcomes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM weekly_plans wp
      WHERE wp.id = weekly_plan_outcomes.weekly_plan_id
      AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their weekly plan outcomes"
  ON weekly_plan_outcomes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM weekly_plans wp
      WHERE wp.id = weekly_plan_outcomes.weekly_plan_id
      AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their weekly plan outcomes"
  ON weekly_plan_outcomes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM weekly_plans wp
      WHERE wp.id = weekly_plan_outcomes.weekly_plan_id
      AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their weekly plan outcomes"
  ON weekly_plan_outcomes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM weekly_plans wp
      WHERE wp.id = weekly_plan_outcomes.weekly_plan_id
      AND wp.user_id = auth.uid()
    )
  );

-- Weekly plan tasks policies (via join to weekly_plans)
CREATE POLICY "Users can view their weekly plan tasks"
  ON weekly_plan_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM weekly_plans wp
      WHERE wp.id = weekly_plan_tasks.weekly_plan_id
      AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their weekly plan tasks"
  ON weekly_plan_tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM weekly_plans wp
      WHERE wp.id = weekly_plan_tasks.weekly_plan_id
      AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their weekly plan tasks"
  ON weekly_plan_tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM weekly_plans wp
      WHERE wp.id = weekly_plan_tasks.weekly_plan_id
      AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their weekly plan tasks"
  ON weekly_plan_tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM weekly_plans wp
      WHERE wp.id = weekly_plan_tasks.weekly_plan_id
      AND wp.user_id = auth.uid()
    )
  );

-- ===================================================================
-- PART 5: Create trigger for updated_at
-- ===================================================================

CREATE OR REPLACE FUNCTION update_weekly_plans_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_weekly_plans_updated_at ON weekly_plans;
CREATE TRIGGER update_weekly_plans_updated_at
  BEFORE UPDATE ON weekly_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_plans_timestamp();

-- ===================================================================
-- PART 6: Helper functions
-- ===================================================================

-- Get current ISO week info
CREATE OR REPLACE FUNCTION get_current_iso_week()
RETURNS TABLE (
  week_number INTEGER,
  year INTEGER,
  week_start DATE,
  week_end DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(WEEK FROM CURRENT_DATE)::INTEGER as week_number,
    EXTRACT(ISOYEAR FROM CURRENT_DATE)::INTEGER as year,
    DATE_TRUNC('week', CURRENT_DATE)::DATE as week_start,
    (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')::DATE as week_end;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get the latest plan for a user in a given week
CREATE OR REPLACE FUNCTION get_weekly_plan(p_user_id UUID, p_year INTEGER, p_week INTEGER)
RETURNS TABLE (
  id UUID,
  version INTEGER,
  status TEXT,
  available_capacity_minutes INTEGER,
  planned_capacity_minutes INTEGER,
  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wp.id,
    wp.version,
    wp.status,
    wp.available_capacity_minutes,
    wp.planned_capacity_minutes,
    wp.committed_at,
    wp.created_at
  FROM weekly_plans wp
  WHERE wp.user_id = p_user_id
    AND wp.year = p_year
    AND wp.week_number = p_week
  ORDER BY wp.version DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get previous week's completed tasks for review
CREATE OR REPLACE FUNCTION get_previous_week_summary(p_user_id UUID)
RETURNS TABLE (
  completed_tasks INTEGER,
  total_planned_tasks INTEGER,
  total_minutes_completed INTEGER,
  top_outcomes JSONB
) AS $$
DECLARE
  v_prev_week INTEGER;
  v_prev_year INTEGER;
BEGIN
  -- Calculate previous week
  SELECT
    EXTRACT(WEEK FROM CURRENT_DATE - INTERVAL '7 days')::INTEGER,
    EXTRACT(ISOYEAR FROM CURRENT_DATE - INTERVAL '7 days')::INTEGER
  INTO v_prev_week, v_prev_year;

  RETURN QUERY
  WITH prev_plan AS (
    SELECT wp.id
    FROM weekly_plans wp
    WHERE wp.user_id = p_user_id
      AND wp.year = v_prev_year
      AND wp.week_number = v_prev_week
      AND wp.status IN ('committed', 'completed')
    ORDER BY wp.version DESC
    LIMIT 1
  ),
  task_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE fp.status = 'completed') as completed,
      COUNT(*) as total,
      COALESCE(SUM(wpt.estimated_minutes) FILTER (WHERE fp.status = 'completed'), 0) as minutes
    FROM weekly_plan_tasks wpt
    JOIN focus_plans fp ON fp.id = wpt.task_id
    WHERE wpt.weekly_plan_id = (SELECT id FROM prev_plan)
  ),
  outcome_stats AS (
    SELECT jsonb_agg(jsonb_build_object(
      'title', o.title,
      'completed_tasks', (
        SELECT COUNT(*)
        FROM weekly_plan_tasks wpt2
        JOIN focus_plans fp2 ON fp2.id = wpt2.task_id
        WHERE wpt2.weekly_plan_id = (SELECT id FROM prev_plan)
          AND fp2.outcome_id = o.id
          AND fp2.status = 'completed'
      )
    )) as outcomes
    FROM weekly_plan_outcomes wpo
    JOIN outcomes o ON o.id = wpo.outcome_id
    WHERE wpo.weekly_plan_id = (SELECT id FROM prev_plan)
  )
  SELECT
    ts.completed::INTEGER,
    ts.total::INTEGER,
    ts.minutes::INTEGER,
    COALESCE(os.outcomes, '[]'::JSONB)
  FROM task_stats ts
  CROSS JOIN outcome_stats os;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate capacity for a weekly plan
CREATE OR REPLACE FUNCTION calculate_plan_capacity(p_weekly_plan_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(estimated_minutes), 0)
  INTO v_total
  FROM weekly_plan_tasks
  WHERE weekly_plan_id = p_weekly_plan_id;

  -- Update the plan's planned_capacity_minutes
  UPDATE weekly_plans
  SET planned_capacity_minutes = v_total
  WHERE id = p_weekly_plan_id;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- PART 7: Analytics events table
-- ===================================================================

CREATE TABLE IF NOT EXISTS weekly_planning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'planning_started',
    'review_completed',
    'outcomes_selected',
    'capacity_set',
    'plan_committed',
    'plan_completed',
    'plan_abandoned',
    'plan_revised',
    'overcommitment_warning_shown',
    'overcommitment_warning_dismissed'
  )),
  weekly_plan_id UUID REFERENCES weekly_plans(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS
ALTER TABLE weekly_planning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own planning events"
  ON weekly_planning_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own planning events"
  ON weekly_planning_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_weekly_planning_events_user_id
ON weekly_planning_events(user_id);

CREATE INDEX IF NOT EXISTS idx_weekly_planning_events_plan_id
ON weekly_planning_events(weekly_plan_id);

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Check weekly_plans table
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'weekly_plans';

-- Check weekly_plan_outcomes table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'weekly_plan_outcomes';

-- Check weekly_plan_tasks table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'weekly_plan_tasks';

-- ===================================================================
-- ROLLBACK (if needed)
-- ===================================================================
-- Uncomment and run these if you need to undo the migration

-- DROP FUNCTION IF EXISTS calculate_plan_capacity(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS get_previous_week_summary(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS get_weekly_plan(UUID, INTEGER, INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS get_current_iso_week() CASCADE;
-- DROP FUNCTION IF EXISTS update_weekly_plans_timestamp() CASCADE;
-- DROP TABLE IF EXISTS weekly_planning_events CASCADE;
-- DROP TABLE IF EXISTS weekly_plan_tasks CASCADE;
-- DROP TABLE IF EXISTS weekly_plan_outcomes CASCADE;
-- DROP TABLE IF EXISTS weekly_plans CASCADE;

-- ===================================================================
-- END OF MIGRATION
-- ===================================================================
