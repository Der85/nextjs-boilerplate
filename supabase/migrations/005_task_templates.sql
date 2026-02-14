-- ============================
-- Task Templates
-- Reusable task blueprints for ADHD users
-- ============================

CREATE TABLE IF NOT EXISTS task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  task_name text NOT NULL,
  description text,
  priority text CHECK (priority IN ('low', 'medium', 'high')),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  is_recurring_default boolean DEFAULT false,
  recurrence_rule jsonb,
  tags text[] DEFAULT '{}',
  use_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

COMMENT ON TABLE task_templates IS 'Reusable task blueprints - save frequently repeated tasks as templates';
COMMENT ON COLUMN task_templates.name IS 'Template name shown in picker (e.g., "Weekly Grocery Shop")';
COMMENT ON COLUMN task_templates.task_name IS 'Default task title when creating from template';
COMMENT ON COLUMN task_templates.use_count IS 'Times used - for sorting by frequency';

ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own templates" ON task_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own templates" ON task_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON task_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON task_templates FOR DELETE USING (auth.uid() = user_id);

-- Index for most-used sorting
CREATE INDEX IF NOT EXISTS idx_templates_user_usage ON task_templates(user_id, use_count DESC, last_used_at DESC NULLS LAST);

-- Index for name search
CREATE INDEX IF NOT EXISTS idx_templates_user_name ON task_templates(user_id, name);

-- Trigger to auto-update updated_at
CREATE TRIGGER task_templates_updated_at BEFORE UPDATE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
