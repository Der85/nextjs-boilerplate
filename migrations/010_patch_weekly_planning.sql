-- ===================================================================
-- Migration 010 PATCH: Complete Weekly Planning Setup
-- ===================================================================
-- Run this if migration 010 partially failed (e.g. "policy already exists")
-- This script is safe to re-run - all operations use IF NOT EXISTS / OR REPLACE
-- ===================================================================

-- ===================================================================
-- PART 1: Ensure tables exist (safe to re-run)
-- ===================================================================

CREATE TABLE IF NOT EXISTS weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'committed', 'completed', 'abandoned')),
  available_capacity_minutes INTEGER NOT NULL DEFAULT 480,
  planned_capacity_minutes INTEGER NOT NULL DEFAULT 0,
  previous_week_reflection TEXT,
  wins TEXT[],
  learnings TEXT[],
  summary_markdown TEXT,
  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_week_version UNIQUE (user_id, year, week_number, version)
);

CREATE TABLE IF NOT EXISTS weekly_plan_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_plan_id UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  outcome_id UUID NOT NULL REFERENCES outcomes(id) ON DELETE CASCADE,
  priority_rank INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_plan_outcome UNIQUE (weekly_plan_id, outcome_id)
);

CREATE TABLE IF NOT EXISTS weekly_plan_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_plan_id UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES focus_plans(id) ON DELETE CASCADE,
  scheduled_day INTEGER CHECK (scheduled_day >= 0 AND scheduled_day <= 6),
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  priority_rank INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_plan_task UNIQUE (weekly_plan_id, task_id)
);

CREATE TABLE IF NOT EXISTS weekly_planning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'planning_started', 'review_completed', 'outcomes_selected',
    'capacity_set', 'plan_committed', 'plan_completed',
    'plan_abandoned', 'plan_revised',
    'overcommitment_warning_shown', 'overcommitment_warning_dismissed'
  )),
  weekly_plan_id UUID REFERENCES weekly_plans(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================================================================
-- PART 2: Ensure indexes exist (safe to re-run)
-- ===================================================================

CREATE INDEX IF NOT EXISTS idx_weekly_plans_user_id ON weekly_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_week ON weekly_plans(user_id, year DESC, week_number DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_status ON weekly_plans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_weekly_plan_outcomes_plan_id ON weekly_plan_outcomes(weekly_plan_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plan_outcomes_outcome_id ON weekly_plan_outcomes(outcome_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plan_tasks_plan_id ON weekly_plan_tasks(weekly_plan_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plan_tasks_task_id ON weekly_plan_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plan_tasks_day ON weekly_plan_tasks(weekly_plan_id, scheduled_day);
CREATE INDEX IF NOT EXISTS idx_weekly_planning_events_user_id ON weekly_planning_events(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_planning_events_plan_id ON weekly_planning_events(weekly_plan_id);

-- ===================================================================
-- PART 3: Enable RLS (safe to re-run)
-- ===================================================================

ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plan_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plan_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_planning_events ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- PART 4: RLS policies (DROP IF EXISTS + CREATE for idempotency)
-- ===================================================================

-- weekly_plans
DROP POLICY IF EXISTS "Users can view their own weekly plans" ON weekly_plans;
CREATE POLICY "Users can view their own weekly plans" ON weekly_plans FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own weekly plans" ON weekly_plans;
CREATE POLICY "Users can create their own weekly plans" ON weekly_plans FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own weekly plans" ON weekly_plans;
CREATE POLICY "Users can update their own weekly plans" ON weekly_plans FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own weekly plans" ON weekly_plans;
CREATE POLICY "Users can delete their own weekly plans" ON weekly_plans FOR DELETE USING (auth.uid() = user_id);

-- weekly_plan_outcomes
DROP POLICY IF EXISTS "Users can view their weekly plan outcomes" ON weekly_plan_outcomes;
CREATE POLICY "Users can view their weekly plan outcomes" ON weekly_plan_outcomes FOR SELECT
  USING (EXISTS (SELECT 1 FROM weekly_plans wp WHERE wp.id = weekly_plan_outcomes.weekly_plan_id AND wp.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create their weekly plan outcomes" ON weekly_plan_outcomes;
CREATE POLICY "Users can create their weekly plan outcomes" ON weekly_plan_outcomes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM weekly_plans wp WHERE wp.id = weekly_plan_outcomes.weekly_plan_id AND wp.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their weekly plan outcomes" ON weekly_plan_outcomes;
CREATE POLICY "Users can update their weekly plan outcomes" ON weekly_plan_outcomes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM weekly_plans wp WHERE wp.id = weekly_plan_outcomes.weekly_plan_id AND wp.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their weekly plan outcomes" ON weekly_plan_outcomes;
CREATE POLICY "Users can delete their weekly plan outcomes" ON weekly_plan_outcomes FOR DELETE
  USING (EXISTS (SELECT 1 FROM weekly_plans wp WHERE wp.id = weekly_plan_outcomes.weekly_plan_id AND wp.user_id = auth.uid()));

-- weekly_plan_tasks
DROP POLICY IF EXISTS "Users can view their weekly plan tasks" ON weekly_plan_tasks;
CREATE POLICY "Users can view their weekly plan tasks" ON weekly_plan_tasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM weekly_plans wp WHERE wp.id = weekly_plan_tasks.weekly_plan_id AND wp.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create their weekly plan tasks" ON weekly_plan_tasks;
CREATE POLICY "Users can create their weekly plan tasks" ON weekly_plan_tasks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM weekly_plans wp WHERE wp.id = weekly_plan_tasks.weekly_plan_id AND wp.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their weekly plan tasks" ON weekly_plan_tasks;
CREATE POLICY "Users can update their weekly plan tasks" ON weekly_plan_tasks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM weekly_plans wp WHERE wp.id = weekly_plan_tasks.weekly_plan_id AND wp.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their weekly plan tasks" ON weekly_plan_tasks;
CREATE POLICY "Users can delete their weekly plan tasks" ON weekly_plan_tasks FOR DELETE
  USING (EXISTS (SELECT 1 FROM weekly_plans wp WHERE wp.id = weekly_plan_tasks.weekly_plan_id AND wp.user_id = auth.uid()));

-- weekly_planning_events
DROP POLICY IF EXISTS "Users can view their own planning events" ON weekly_planning_events;
CREATE POLICY "Users can view their own planning events" ON weekly_planning_events FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own planning events" ON weekly_planning_events;
CREATE POLICY "Users can create their own planning events" ON weekly_planning_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ===================================================================
-- PART 5: Trigger (safe to re-run with OR REPLACE + DROP IF EXISTS)
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
-- PART 6: Helper functions (safe to re-run with OR REPLACE)
-- ===================================================================

CREATE OR REPLACE FUNCTION get_current_iso_week()
RETURNS TABLE (week_number INTEGER, year INTEGER, week_start DATE, week_end DATE) AS $$
BEGIN
  RETURN QUERY SELECT
    EXTRACT(WEEK FROM CURRENT_DATE)::INTEGER,
    EXTRACT(ISOYEAR FROM CURRENT_DATE)::INTEGER,
    DATE_TRUNC('week', CURRENT_DATE)::DATE,
    (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')::DATE;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_weekly_plan(p_user_id UUID, p_year INTEGER, p_week INTEGER)
RETURNS TABLE (id UUID, version INTEGER, status TEXT, available_capacity_minutes INTEGER, planned_capacity_minutes INTEGER, committed_at TIMESTAMPTZ, created_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY SELECT wp.id, wp.version, wp.status, wp.available_capacity_minutes, wp.planned_capacity_minutes, wp.committed_at, wp.created_at
  FROM weekly_plans wp WHERE wp.user_id = p_user_id AND wp.year = p_year AND wp.week_number = p_week
  ORDER BY wp.version DESC LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION calculate_plan_capacity(p_weekly_plan_id UUID)
RETURNS INTEGER AS $$
DECLARE v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(estimated_minutes), 0) INTO v_total FROM weekly_plan_tasks WHERE weekly_plan_id = p_weekly_plan_id;
  UPDATE weekly_plans SET planned_capacity_minutes = v_total WHERE id = p_weekly_plan_id;
  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- VERIFICATION
-- ===================================================================
SELECT 'weekly_plans' as table_name, count(*) as row_count FROM weekly_plans
UNION ALL SELECT 'weekly_plan_outcomes', count(*) FROM weekly_plan_outcomes
UNION ALL SELECT 'weekly_plan_tasks', count(*) FROM weekly_plan_tasks
UNION ALL SELECT 'weekly_planning_events', count(*) FROM weekly_planning_events;
