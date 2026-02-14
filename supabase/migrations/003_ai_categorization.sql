-- ============================
-- AI Task Categorization Migration
-- ============================

-- Add category_confidence to tasks for AI categorization confidence
ALTER TABLE tasks
  ADD COLUMN category_confidence numeric(3,2);

COMMENT ON COLUMN tasks.category_confidence IS 'AI confidence in category assignment (0.0 to 1.0). NULL if manually set.';

-- Add is_system to categories for default system categories
ALTER TABLE categories
  ADD COLUMN is_system boolean DEFAULT false;

COMMENT ON COLUMN categories.is_system IS 'True for default system categories (Work, Health, etc). Users can edit but should confirm before deleting.';

-- Index for finding uncategorized tasks
CREATE INDEX idx_tasks_uncategorized ON tasks(user_id)
  WHERE status = 'active' AND category_id IS NULL;

-- Index for finding low-confidence categorizations
CREATE INDEX idx_tasks_low_confidence_category ON tasks(user_id, category_confidence)
  WHERE status = 'active' AND category_confidence IS NOT NULL AND category_confidence < 0.7;
