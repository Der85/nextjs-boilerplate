-- ============================
-- Additional constraints and indexes
-- Closes gaps in data integrity and query performance
-- ============================

-- 1. Unique position per user for tasks (prevents duplicate positions)
-- Using a partial unique index since position can be null for unordered tasks
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_user_position_unique
  ON tasks(user_id, position)
  WHERE position IS NOT NULL;

-- 2. Unique position per user for categories
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_position_unique
  ON categories(user_id, position)
  WHERE position IS NOT NULL;

-- 3. Composite index for reminders GET query pattern
-- Covers: WHERE user_id = ? AND dismissed_at IS NULL AND scheduled_for <= now
CREATE INDEX IF NOT EXISTS idx_reminders_user_scheduled_active
  ON reminders(user_id, scheduled_for)
  WHERE dismissed_at IS NULL;

-- 4. Update category_suggestions status CHECK to include 'processing'
-- The accept flow uses 'processing' as an optimistic lock
ALTER TABLE category_suggestions
  DROP CONSTRAINT IF EXISTS category_suggestions_status_check;

ALTER TABLE category_suggestions
  ADD CONSTRAINT category_suggestions_status_check
  CHECK (status IN ('pending', 'processing', 'accepted', 'dismissed'));
