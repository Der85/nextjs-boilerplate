-- ===================================================================
-- Migration 011: Shame-safe Rescheduling (Task Renegotiations)
-- ===================================================================
-- Run this migration after 010_create_weekly_planning.sql
-- Go to: Supabase Dashboard > SQL Editor > New Query
-- ===================================================================

-- ===================================================================
-- PART 1: Add renegotiation fields to focus_plans
-- ===================================================================

ALTER TABLE focus_plans
ADD COLUMN IF NOT EXISTS last_renegotiated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS renegotiation_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_due_date DATE,
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES focus_plans(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS split_reason TEXT;

-- Add index for finding tasks that need renegotiation
CREATE INDEX IF NOT EXISTS idx_focus_plans_due_date
ON focus_plans(user_id, due_date)
WHERE status NOT IN ('completed', 'parked', 'dropped');

-- Add index for split task relationships
CREATE INDEX IF NOT EXISTS idx_focus_plans_parent_task
ON focus_plans(parent_task_id)
WHERE parent_task_id IS NOT NULL;

COMMENT ON COLUMN focus_plans.last_renegotiated_at IS 'When the task was last renegotiated';
COMMENT ON COLUMN focus_plans.renegotiation_count IS 'Number of times this task has been renegotiated';
COMMENT ON COLUMN focus_plans.original_due_date IS 'Original due date before any renegotiations';
COMMENT ON COLUMN focus_plans.parent_task_id IS 'Reference to parent task if this was created via split';
COMMENT ON COLUMN focus_plans.split_reason IS 'Reason for splitting if this is a split subtask';

-- ===================================================================
-- PART 2: Create task_renegotiations table
-- ===================================================================

CREATE TABLE IF NOT EXISTS task_renegotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES focus_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What happened
  action TEXT NOT NULL CHECK (action IN ('reschedule', 'split', 'park', 'drop')),

  -- Date changes
  from_due_date DATE,
  to_due_date DATE,

  -- Reason tracking
  reason_code TEXT NOT NULL CHECK (reason_code IN (
    'underestimated',
    'interruption',
    'low_energy',
    'dependencies_blocked',
    'changed_priorities',
    'forgot',
    'life_happened',
    'other'
  )),
  reason_text TEXT, -- Optional free-form explanation

  -- For split actions
  split_into_task_ids UUID[], -- Array of new subtask IDs

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_task_renegotiations_task_id
ON task_renegotiations(task_id);

CREATE INDEX IF NOT EXISTS idx_task_renegotiations_user_id
ON task_renegotiations(user_id);

CREATE INDEX IF NOT EXISTS idx_task_renegotiations_created_at
ON task_renegotiations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_renegotiations_action
ON task_renegotiations(user_id, action);

-- Add comments
COMMENT ON TABLE task_renegotiations IS 'History of task renegotiations for shame-free rescheduling';
COMMENT ON COLUMN task_renegotiations.action IS 'reschedule=new date, split=break down, park=pause, drop=abandon';
COMMENT ON COLUMN task_renegotiations.reason_code IS 'Standardized reason for renegotiation';
COMMENT ON COLUMN task_renegotiations.split_into_task_ids IS 'IDs of subtasks created during split action';

-- ===================================================================
-- PART 3: Add RLS policies
-- ===================================================================

ALTER TABLE task_renegotiations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own renegotiations"
  ON task_renegotiations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own renegotiations"
  ON task_renegotiations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No update/delete - renegotiations are immutable history

-- ===================================================================
-- PART 4: Analytics events table for renegotiations
-- ===================================================================

CREATE TABLE IF NOT EXISTS renegotiation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'task_renegotiated',
    'task_split_from_renegotiation',
    'task_dropped_after_review',
    'task_parked_for_later',
    'repeat_renegotiation_pattern_detected',
    'renegotiation_modal_shown',
    'renegotiation_modal_dismissed',
    'quick_reschedule_used'
  )),
  task_id UUID REFERENCES focus_plans(id) ON DELETE SET NULL,
  renegotiation_id UUID REFERENCES task_renegotiations(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS
ALTER TABLE renegotiation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own renegotiation events"
  ON renegotiation_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own renegotiation events"
  ON renegotiation_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_renegotiation_events_user_id
ON renegotiation_events(user_id);

CREATE INDEX IF NOT EXISTS idx_renegotiation_events_task_id
ON renegotiation_events(task_id);

-- ===================================================================
-- PART 5: Helper functions
-- ===================================================================

-- Get tasks that need renegotiation (overdue and not completed/parked/dropped)
CREATE OR REPLACE FUNCTION get_tasks_needing_renegotiation(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  due_date DATE,
  days_overdue INTEGER,
  renegotiation_count INTEGER,
  outcome_title TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fp.id,
    fp.title,
    fp.due_date,
    (CURRENT_DATE - fp.due_date)::INTEGER as days_overdue,
    fp.renegotiation_count,
    o.title as outcome_title
  FROM focus_plans fp
  LEFT JOIN outcomes o ON o.id = fp.outcome_id
  WHERE fp.user_id = p_user_id
    AND fp.due_date < CURRENT_DATE
    AND fp.status NOT IN ('completed', 'parked', 'dropped')
  ORDER BY fp.due_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get renegotiation history for a task
CREATE OR REPLACE FUNCTION get_task_renegotiation_history(p_task_id UUID)
RETURNS TABLE (
  id UUID,
  action TEXT,
  from_due_date DATE,
  to_due_date DATE,
  reason_code TEXT,
  reason_text TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tr.id,
    tr.action,
    tr.from_due_date,
    tr.to_due_date,
    tr.reason_code,
    tr.reason_text,
    tr.created_at
  FROM task_renegotiations tr
  WHERE tr.task_id = p_task_id
  ORDER BY tr.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get renegotiation patterns (for detecting repeat renegotiators)
CREATE OR REPLACE FUNCTION get_renegotiation_patterns(p_user_id UUID, p_days INTEGER DEFAULT 14)
RETURNS TABLE (
  task_id UUID,
  task_title TEXT,
  renegotiation_count INTEGER,
  most_common_reason TEXT,
  suggestion TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_renegotiations AS (
    SELECT
      tr.task_id,
      tr.reason_code,
      COUNT(*) as count
    FROM task_renegotiations tr
    WHERE tr.user_id = p_user_id
      AND tr.created_at >= CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
    GROUP BY tr.task_id, tr.reason_code
  ),
  task_totals AS (
    SELECT
      task_id,
      SUM(count) as total_count,
      (ARRAY_AGG(reason_code ORDER BY count DESC))[1] as top_reason
    FROM recent_renegotiations
    GROUP BY task_id
    HAVING SUM(count) >= 3
  )
  SELECT
    tt.task_id,
    fp.title as task_title,
    tt.total_count::INTEGER as renegotiation_count,
    tt.top_reason as most_common_reason,
    CASE
      WHEN tt.top_reason = 'underestimated' THEN 'Consider breaking this into smaller tasks'
      WHEN tt.top_reason = 'low_energy' THEN 'Schedule during your high-energy times'
      WHEN tt.top_reason = 'changed_priorities' THEN 'Consider if this is still important'
      WHEN tt.top_reason = 'dependencies_blocked' THEN 'Focus on unblocking dependencies first'
      ELSE 'Consider dropping or delegating this task'
    END as suggestion
  FROM task_totals tt
  JOIN focus_plans fp ON fp.id = tt.task_id
  WHERE fp.status NOT IN ('completed', 'parked', 'dropped');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record a renegotiation and update task
CREATE OR REPLACE FUNCTION record_task_renegotiation(
  p_task_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_new_due_date DATE,
  p_reason_code TEXT,
  p_reason_text TEXT DEFAULT NULL,
  p_new_status TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_old_due_date DATE;
  v_renegotiation_id UUID;
BEGIN
  -- Get current due date
  SELECT due_date INTO v_old_due_date
  FROM focus_plans
  WHERE id = p_task_id AND user_id = p_user_id;

  IF v_old_due_date IS NULL AND p_action != 'drop' THEN
    RAISE EXCEPTION 'Task not found or not owned by user';
  END IF;

  -- Create renegotiation record
  INSERT INTO task_renegotiations (
    task_id,
    user_id,
    action,
    from_due_date,
    to_due_date,
    reason_code,
    reason_text
  ) VALUES (
    p_task_id,
    p_user_id,
    p_action,
    v_old_due_date,
    p_new_due_date,
    p_reason_code,
    p_reason_text
  )
  RETURNING id INTO v_renegotiation_id;

  -- Update the task
  UPDATE focus_plans
  SET
    due_date = COALESCE(p_new_due_date, due_date),
    status = COALESCE(p_new_status, status),
    last_renegotiated_at = NOW(),
    renegotiation_count = renegotiation_count + 1,
    original_due_date = COALESCE(original_due_date, v_old_due_date),
    updated_at = NOW()
  WHERE id = p_task_id
    AND user_id = p_user_id;

  RETURN v_renegotiation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Check task_renegotiations table
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'task_renegotiations';

-- Check new focus_plans columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'focus_plans'
  AND column_name IN ('last_renegotiated_at', 'renegotiation_count', 'original_due_date', 'parent_task_id');

-- ===================================================================
-- ROLLBACK (if needed)
-- ===================================================================
-- Uncomment and run these if you need to undo the migration

-- DROP FUNCTION IF EXISTS record_task_renegotiation(UUID, UUID, TEXT, DATE, TEXT, TEXT, TEXT) CASCADE;
-- DROP FUNCTION IF EXISTS get_renegotiation_patterns(UUID, INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS get_task_renegotiation_history(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS get_tasks_needing_renegotiation(UUID) CASCADE;
-- DROP TABLE IF EXISTS renegotiation_events CASCADE;
-- DROP TABLE IF EXISTS task_renegotiations CASCADE;
-- ALTER TABLE focus_plans DROP COLUMN IF EXISTS last_renegotiated_at;
-- ALTER TABLE focus_plans DROP COLUMN IF EXISTS renegotiation_count;
-- ALTER TABLE focus_plans DROP COLUMN IF EXISTS original_due_date;
-- ALTER TABLE focus_plans DROP COLUMN IF EXISTS parent_task_id;
-- ALTER TABLE focus_plans DROP COLUMN IF EXISTS split_reason;

-- ===================================================================
-- END OF MIGRATION
-- ===================================================================
