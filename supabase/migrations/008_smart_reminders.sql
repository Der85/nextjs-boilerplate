-- ============================
-- Smart Reminders
-- Context-aware in-app notification system
-- ============================

-- Reminder Preferences (one per user)
CREATE TABLE IF NOT EXISTS reminder_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reminders_enabled boolean NOT NULL DEFAULT true,
  quiet_hours_start time DEFAULT '22:00', -- don't remind after this
  quiet_hours_end time DEFAULT '08:00', -- don't remind before this
  max_reminders_per_day integer NOT NULL DEFAULT 5,
  reminder_lead_time_minutes integer NOT NULL DEFAULT 30, -- remind X minutes before due_time
  preferred_reminder_times time[] DEFAULT ARRAY['09:00'::time, '13:00'::time, '17:00'::time],
  weekend_reminders boolean NOT NULL DEFAULT false,
  high_priority_override boolean NOT NULL DEFAULT true, -- high priority can break quiet hours (except sleep)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE reminder_preferences IS 'User preferences for smart reminder system';
COMMENT ON COLUMN reminder_preferences.quiet_hours_start IS 'Do not send reminders after this time';
COMMENT ON COLUMN reminder_preferences.quiet_hours_end IS 'Do not send reminders before this time';
COMMENT ON COLUMN reminder_preferences.preferred_reminder_times IS 'Fallback times when tasks have no due_time';
COMMENT ON COLUMN reminder_preferences.high_priority_override IS 'Allow high-priority tasks to remind during quiet hours (not sleep hours)';

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('due_soon', 'overdue', 'priority_nudge', 'recurring_due', 'suggestion_follow_up')),
  scheduled_for timestamptz NOT NULL,
  delivered_at timestamptz, -- null = not yet delivered
  read_at timestamptz, -- null = not yet read
  snoozed_until timestamptz, -- null = not snoozed
  dismissed_at timestamptz, -- null = not dismissed
  title text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('gentle', 'normal', 'important')),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE reminders IS 'In-app notification reminders for tasks';
COMMENT ON COLUMN reminders.reminder_type IS 'due_soon, overdue, priority_nudge, recurring_due, suggestion_follow_up';
COMMENT ON COLUMN reminders.priority IS 'gentle (blue), normal (yellow), important (red)';
COMMENT ON COLUMN reminders.delivered_at IS 'Set when reminder is first shown to user';
COMMENT ON COLUMN reminders.snoozed_until IS 'If set, reminder is hidden until this time';

-- Enable RLS
ALTER TABLE reminder_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies for reminder_preferences
CREATE POLICY "Users can read own preferences" ON reminder_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON reminder_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON reminder_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for reminders
CREATE POLICY "Users can read own reminders" ON reminders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reminders" ON reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reminders" ON reminders
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reminders" ON reminders
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_reminders_user_delivery ON reminders(user_id, delivered_at, dismissed_at);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON reminders(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_reminders_task ON reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_snoozed ON reminders(user_id, snoozed_until)
  WHERE snoozed_until IS NOT NULL;

-- Updated_at trigger for preferences
CREATE TRIGGER reminder_preferences_updated_at BEFORE UPDATE ON reminder_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
