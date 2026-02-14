-- ============================
-- Task Suggestions
-- AI-powered priority-aware task recommendations
-- ============================

CREATE TABLE IF NOT EXISTS task_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggested_task_name text NOT NULL,
  suggested_steps jsonb DEFAULT '[]',
  suggested_category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  suggested_energy text DEFAULT 'medium' CHECK (suggested_energy IN ('low', 'medium', 'high')),
  suggested_estimated_minutes integer,
  reasoning text NOT NULL, -- why the AI suggested this (shown to user)
  priority_domain text NOT NULL, -- which priority domain this serves
  suggestion_type text NOT NULL CHECK (suggestion_type IN ('gap_fill', 'priority_boost', 'routine_suggestion', 'template_based', 'seasonal')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'snoozed')),
  snoozed_until timestamptz,
  source_template_id uuid REFERENCES task_templates(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  dismissed_at timestamptz
);

COMMENT ON TABLE task_suggestions IS 'AI-generated task suggestions based on user priorities and activity gaps';
COMMENT ON COLUMN task_suggestions.reasoning IS 'Human-readable explanation of why this was suggested';
COMMENT ON COLUMN task_suggestions.priority_domain IS 'Life domain this task serves (Work, Health, etc.)';
COMMENT ON COLUMN task_suggestions.suggestion_type IS 'gap_fill=filling neglected areas, priority_boost=supporting top priorities, etc.';
COMMENT ON COLUMN task_suggestions.source_template_id IS 'If suggestion is based on an existing template';

-- Enable RLS
ALTER TABLE task_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own suggestions" ON task_suggestions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own suggestions" ON task_suggestions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own suggestions" ON task_suggestions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own suggestions" ON task_suggestions
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_suggestions_user_status ON task_suggestions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_suggestions_user_created ON task_suggestions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_snoozed ON task_suggestions(user_id, status, snoozed_until)
  WHERE status = 'snoozed';

-- Auto-update trigger (reuse existing function)
CREATE TRIGGER task_suggestions_updated_at BEFORE UPDATE ON task_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
