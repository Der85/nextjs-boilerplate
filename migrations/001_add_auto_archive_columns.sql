-- Migration: Add auto-archive columns to focus_plans table
-- This supports the auto-archive functionality for overdue tasks

-- Add auto_archived flag (default false for existing rows)
ALTER TABLE focus_plans
ADD COLUMN IF NOT EXISTS auto_archived boolean DEFAULT false;

-- Add auto_archived_at timestamp
ALTER TABLE focus_plans
ADD COLUMN IF NOT EXISTS auto_archived_at timestamptz;

-- Add original_due_date to preserve the original due date before archiving
ALTER TABLE focus_plans
ADD COLUMN IF NOT EXISTS original_due_date date;

-- Add status column if it doesn't exist (for 'parked' state)
-- Note: This may already exist, the IF NOT EXISTS handles that
ALTER TABLE focus_plans
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Create an index on auto_archived for efficient queries
CREATE INDEX IF NOT EXISTS idx_focus_plans_auto_archived
ON focus_plans (user_id, auto_archived)
WHERE auto_archived = true;

-- Create an index on auto_archived_at for recent queries
CREATE INDEX IF NOT EXISTS idx_focus_plans_auto_archived_at
ON focus_plans (user_id, auto_archived_at)
WHERE auto_archived_at IS NOT NULL;

-- Update RLS policies to include new columns (they're automatically covered
-- by existing row-level policies, but ensure SELECT includes them)
-- No changes needed if existing policies use SELECT * or cover all columns

COMMENT ON COLUMN focus_plans.auto_archived IS 'True if the task was automatically archived due to being overdue 2+ days';
COMMENT ON COLUMN focus_plans.auto_archived_at IS 'Timestamp when the task was auto-archived';
COMMENT ON COLUMN focus_plans.original_due_date IS 'Original due date before auto-archiving, for reference if user reviews';
