-- ===================================================================
-- Migration 008: Now Mode - Limit Active Cognitive Load to 3 Tasks
-- ===================================================================
-- Run this migration after 007_create_inbox_items_table.sql
-- Go to: Supabase Dashboard > SQL Editor > New Query
-- ===================================================================

-- ===================================================================
-- PART 1: Add now_slot column to focus_plans
-- ===================================================================
-- Tasks can be pinned to slots 1, 2, or 3 in Now Mode

ALTER TABLE focus_plans
ADD COLUMN IF NOT EXISTS now_slot INTEGER CHECK (now_slot >= 1 AND now_slot <= 3);

-- Add index for efficient Now Mode queries
CREATE INDEX IF NOT EXISTS idx_focus_plans_now_slot
ON focus_plans(user_id, now_slot)
WHERE now_slot IS NOT NULL;

-- Add estimated_minutes for time estimates
ALTER TABLE focus_plans
ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER CHECK (estimated_minutes >= 1 AND estimated_minutes <= 480);

COMMENT ON COLUMN focus_plans.now_slot IS 'Now Mode slot position (1-3). NULL means not in Now Mode.';
COMMENT ON COLUMN focus_plans.estimated_minutes IS 'Estimated time to complete task in minutes.';

-- ===================================================================
-- PART 2: Add Now Mode preferences to user_stats
-- ===================================================================

ALTER TABLE user_stats
ADD COLUMN IF NOT EXISTS now_mode_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE user_stats
ADD COLUMN IF NOT EXISTS now_mode_strict_limit BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN user_stats.now_mode_enabled IS 'Whether Now Mode is enabled for this user (default: true)';
COMMENT ON COLUMN user_stats.now_mode_strict_limit IS 'If true, strictly enforce 3-task limit. If false, allow warnings but not blocks (default: true)';

-- ===================================================================
-- PART 3: Create now_mode_events table for analytics
-- ===================================================================

CREATE TABLE IF NOT EXISTS now_mode_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'now_mode_enabled',
    'now_mode_disabled',
    'task_pinned',
    'task_unpinned',
    'task_swapped',
    'all_slots_completed',
    'time_override_warning'
  )),
  task_id UUID REFERENCES focus_plans(id) ON DELETE SET NULL,
  slot_number INTEGER CHECK (slot_number >= 1 AND slot_number <= 3),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies for now_mode_events
ALTER TABLE now_mode_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own now mode events"
  ON now_mode_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own now mode events"
  ON now_mode_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_now_mode_events_user_id
ON now_mode_events(user_id);

CREATE INDEX IF NOT EXISTS idx_now_mode_events_created_at
ON now_mode_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_now_mode_events_type
ON now_mode_events(user_id, event_type);

COMMENT ON TABLE now_mode_events IS 'Analytics events for Now Mode feature tracking';

-- ===================================================================
-- PART 4: Create function to find next available slot
-- ===================================================================

CREATE OR REPLACE FUNCTION get_next_available_now_slot(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  occupied_slots INTEGER[];
  slot INTEGER;
BEGIN
  -- Get list of occupied slots
  SELECT ARRAY_AGG(now_slot ORDER BY now_slot)
  INTO occupied_slots
  FROM focus_plans
  WHERE user_id = p_user_id
    AND now_slot IS NOT NULL
    AND status IN ('active', 'needs_linking');

  -- Find first available slot (1, 2, or 3)
  FOR slot IN 1..3 LOOP
    IF occupied_slots IS NULL OR NOT (slot = ANY(occupied_slots)) THEN
      RETURN slot;
    END IF;
  END LOOP;

  -- All slots occupied
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- PART 5: Create function to count occupied slots
-- ===================================================================

CREATE OR REPLACE FUNCTION count_now_mode_slots(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM focus_plans
    WHERE user_id = p_user_id
      AND now_slot IS NOT NULL
      AND status IN ('active', 'needs_linking')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Check focus_plans columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'focus_plans'
  AND column_name IN ('now_slot', 'estimated_minutes');

-- Check user_stats columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_stats'
  AND column_name IN ('now_mode_enabled', 'now_mode_strict_limit');

-- Check now_mode_events table
SELECT table_name FROM information_schema.tables
WHERE table_name = 'now_mode_events';

-- ===================================================================
-- ROLLBACK (if needed)
-- ===================================================================
-- Uncomment and run these if you need to undo the migration

-- DROP TABLE IF EXISTS now_mode_events CASCADE;
-- DROP FUNCTION IF EXISTS get_next_available_now_slot(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS count_now_mode_slots(UUID) CASCADE;
-- ALTER TABLE focus_plans DROP COLUMN IF EXISTS now_slot CASCADE;
-- ALTER TABLE focus_plans DROP COLUMN IF EXISTS estimated_minutes CASCADE;
-- ALTER TABLE user_stats DROP COLUMN IF EXISTS now_mode_enabled CASCADE;
-- ALTER TABLE user_stats DROP COLUMN IF EXISTS now_mode_strict_limit CASCADE;

-- ===================================================================
-- END OF MIGRATION
-- ===================================================================
