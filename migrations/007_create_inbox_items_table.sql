-- ===================================================================
-- Migration 007: Create inbox_items Table
-- ===================================================================
-- Inbox items are rapid captures that haven't been triaged yet.
-- Optimized for frictionless capture with minimal required fields.
-- ===================================================================
-- Run: Supabase Dashboard > SQL Editor > New Query
-- ===================================================================

-- ===================================================================
-- CREATE INBOX_ITEMS TABLE
-- ===================================================================

CREATE TABLE IF NOT EXISTS inbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Core capture data
  raw_text text NOT NULL,
  source text NOT NULL DEFAULT 'quick_capture' CHECK (source IN ('quick_capture', 'mobile', 'email_forward', 'voice', 'other')),

  -- Parsed tokens (extracted from raw_text)
  parsed_tokens jsonb DEFAULT '{}',
  -- Structure: { due: 'today'|'this_week'|null, project: string|null, priority: 'high'|'medium'|'low'|null }

  -- Triage state
  triage_status text NOT NULL DEFAULT 'pending' CHECK (triage_status IN ('pending', 'triaged', 'discarded')),
  triage_action text CHECK (triage_action IN ('do_now', 'schedule', 'delegate', 'park', 'drop')),
  triage_metadata jsonb DEFAULT '{}',
  -- Structure varies by action:
  -- do_now: { started_timer: boolean }
  -- schedule: { scheduled_date: string, timebox_minutes: number }
  -- delegate: { assignee: string, followup_date: string }
  -- park: { someday_reason: string }
  -- drop: { drop_reason: string }

  triaged_at timestamptz,

  -- Conversion to task
  proposed_task_id uuid REFERENCES focus_plans(id) ON DELETE SET NULL,
  converted_at timestamptz,

  -- Timestamps
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===================================================================
-- INDEXES
-- ===================================================================

-- Primary query: pending items for a user
CREATE INDEX IF NOT EXISTS idx_inbox_items_user_pending
  ON inbox_items(user_id, captured_at DESC)
  WHERE triage_status = 'pending';

-- For counting pending items
CREATE INDEX IF NOT EXISTS idx_inbox_items_user_status
  ON inbox_items(user_id, triage_status);

-- For analytics: capture to triage time
CREATE INDEX IF NOT EXISTS idx_inbox_items_triage_time
  ON inbox_items(user_id, captured_at, triaged_at)
  WHERE triaged_at IS NOT NULL;

-- ===================================================================
-- ROW LEVEL SECURITY
-- ===================================================================

ALTER TABLE inbox_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own inbox_items" ON inbox_items;
CREATE POLICY "Users can view own inbox_items"
  ON inbox_items
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own inbox_items" ON inbox_items;
CREATE POLICY "Users can insert own inbox_items"
  ON inbox_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own inbox_items" ON inbox_items;
CREATE POLICY "Users can update own inbox_items"
  ON inbox_items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own inbox_items" ON inbox_items;
CREATE POLICY "Users can delete own inbox_items"
  ON inbox_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- ===================================================================
-- UPDATED_AT TRIGGER
-- ===================================================================

DROP TRIGGER IF EXISTS update_inbox_items_updated_at ON inbox_items;
CREATE TRIGGER update_inbox_items_updated_at
  BEFORE UPDATE ON inbox_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- COMMENTS
-- ===================================================================

COMMENT ON TABLE inbox_items IS 'Rapid capture items pending triage';
COMMENT ON COLUMN inbox_items.raw_text IS 'Original captured text, may include tokens like @today, #project';
COMMENT ON COLUMN inbox_items.source IS 'Where the capture came from';
COMMENT ON COLUMN inbox_items.parsed_tokens IS 'Extracted tokens from raw_text';
COMMENT ON COLUMN inbox_items.triage_status IS 'Current triage state: pending, triaged, or discarded';
COMMENT ON COLUMN inbox_items.triage_action IS 'Action taken during triage';
COMMENT ON COLUMN inbox_items.proposed_task_id IS 'ID of task created from this inbox item';

-- ===================================================================
-- ROLLBACK
-- ===================================================================
-- To rollback this migration, run:
-- DROP TABLE IF EXISTS inbox_items CASCADE;

-- ===================================================================
-- END OF MIGRATION 007
-- ===================================================================
