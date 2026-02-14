-- ============================
-- Recurring Tasks Migration
-- ============================

-- Add recurring task columns to tasks table
ALTER TABLE tasks
  ADD COLUMN is_recurring boolean DEFAULT false,
  ADD COLUMN recurrence_rule jsonb,
  ADD COLUMN recurrence_parent_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  ADD COLUMN recurring_streak integer DEFAULT 0,
  ADD COLUMN skipped_at timestamptz;

-- Update status CHECK constraint to include 'skipped'
ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('active', 'done', 'dropped', 'skipped'));

-- Index for finding recurring tasks
CREATE INDEX idx_tasks_recurring ON tasks(user_id, is_recurring) WHERE is_recurring = true;

-- Index for finding child tasks of a recurring parent
CREATE INDEX idx_tasks_recurrence_parent ON tasks(recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL;

-- Comment explaining recurrence_rule structure
COMMENT ON COLUMN tasks.recurrence_rule IS 'JSON structure: { "frequency": "daily"|"weekdays"|"weekly"|"biweekly"|"monthly", "interval": number?, "end_date": string? }';
