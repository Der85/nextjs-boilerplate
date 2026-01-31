-- ===================================================================
-- Gamified Check-In Experience - Database Migrations
-- ===================================================================
-- Run these migrations on your Supabase database
-- Go to: Supabase Dashboard > SQL Editor > New Query
-- Paste each section and execute
-- ===================================================================

-- ===================================================================
-- MIGRATION 1: Enhance mood_entries table
-- ===================================================================
-- Add new columns to support gamification and energy tracking

ALTER TABLE mood_entries
ADD COLUMN IF NOT EXISTS energy_level INT CHECK (energy_level >= 0 AND energy_level <= 4),
ADD COLUMN IF NOT EXISTS breathing_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS breathing_skipped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS note_length INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS session_duration_ms INT,
ADD COLUMN IF NOT EXISTS xp_earned INT DEFAULT 10,
ADD COLUMN IF NOT EXISTS achievements_earned JSONB DEFAULT '[]';

-- Add comment to document the columns
COMMENT ON COLUMN mood_entries.energy_level IS 'Energy level 0-4: 0=Depleted, 1=Low, 2=Moderate, 3=High, 4=Overflowing';
COMMENT ON COLUMN mood_entries.breathing_completed IS 'Whether user completed the breathing exercise';
COMMENT ON COLUMN mood_entries.breathing_skipped IS 'Whether user skipped the breathing exercise';
COMMENT ON COLUMN mood_entries.note_length IS 'Character length of the note for analytics';
COMMENT ON COLUMN mood_entries.session_duration_ms IS 'Total time spent in check-in flow (milliseconds)';
COMMENT ON COLUMN mood_entries.xp_earned IS 'Experience points earned from this check-in';
COMMENT ON COLUMN mood_entries.achievements_earned IS 'Array of badge IDs unlocked during this check-in';

-- ===================================================================
-- MIGRATION 2: Create user_stats table
-- ===================================================================
-- Track user progress, XP, level, and achievements

CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp INT NOT NULL DEFAULT 0,
  current_level INT NOT NULL DEFAULT 1,
  achievements_unlocked JSONB NOT NULL DEFAULT '[]',
  last_check_in_time TIMESTAMPTZ,
  preferred_check_in_time TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS (Row Level Security) policies
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Users can only read their own stats
CREATE POLICY "Users can view their own stats"
  ON user_stats
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert/update their own stats
CREATE POLICY "Users can update their own stats"
  ON user_stats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can modify their own stats"
  ON user_stats
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_total_xp ON user_stats(total_xp DESC);

-- Add comments
COMMENT ON TABLE user_stats IS 'Tracks user gamification progress including XP, level, and achievements';
COMMENT ON COLUMN user_stats.total_xp IS 'Total experience points earned across all check-ins';
COMMENT ON COLUMN user_stats.current_level IS 'Current level (1-5: Beginner, 6-10: Regular, 11-20: Veteran, 21+: Master)';
COMMENT ON COLUMN user_stats.achievements_unlocked IS 'Array of badge IDs the user has unlocked';
COMMENT ON COLUMN user_stats.last_check_in_time IS 'Timestamp of most recent check-in (for streak calculation)';
COMMENT ON COLUMN user_stats.preferred_check_in_time IS 'Time of day user typically checks in (for consistency bonus)';

-- ===================================================================
-- MIGRATION 3: Create check_in_sessions table (optional - analytics)
-- ===================================================================
-- Track detailed session metrics for analytics and A/B testing

CREATE TABLE IF NOT EXISTS check_in_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_entry_id UUID REFERENCES mood_entries(id) ON DELETE SET NULL,
  step_timings JSONB,
  completed BOOLEAN DEFAULT FALSE,
  abandoned_at_step VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE check_in_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON check_in_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
  ON check_in_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_check_in_sessions_user_id ON check_in_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_check_in_sessions_created_at ON check_in_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_in_sessions_completed ON check_in_sessions(completed);

-- Add comments
COMMENT ON TABLE check_in_sessions IS 'Analytics table tracking check-in session behavior';
COMMENT ON COLUMN check_in_sessions.step_timings IS 'JSON object with time spent on each step: {"welcome": 3000, "breathe": 12000, ...}';
COMMENT ON COLUMN check_in_sessions.completed IS 'Whether user completed the full check-in flow';
COMMENT ON COLUMN check_in_sessions.abandoned_at_step IS 'Step name where user abandoned (null if completed)';

-- ===================================================================
-- MIGRATION 4: Create function to auto-update user_stats timestamp
-- ===================================================================

CREATE OR REPLACE FUNCTION update_user_stats_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_user_stats_updated_at ON user_stats;
CREATE TRIGGER update_user_stats_updated_at
  BEFORE UPDATE ON user_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_timestamp();

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================
-- Run these to verify migrations were successful

-- Check mood_entries columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'mood_entries'
  AND column_name IN ('energy_level', 'breathing_completed', 'xp_earned', 'achievements_earned');

-- Check user_stats table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'user_stats';

-- Check check_in_sessions table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'check_in_sessions';

-- ===================================================================
-- ROLLBACK (if needed)
-- ===================================================================
-- Uncomment and run these if you need to undo the migrations

-- DROP TABLE IF EXISTS check_in_sessions CASCADE;
-- DROP TABLE IF EXISTS user_stats CASCADE;
-- ALTER TABLE mood_entries DROP COLUMN IF EXISTS energy_level CASCADE;
-- ALTER TABLE mood_entries DROP COLUMN IF EXISTS breathing_completed CASCADE;
-- ALTER TABLE mood_entries DROP COLUMN IF EXISTS breathing_skipped CASCADE;
-- ALTER TABLE mood_entries DROP COLUMN IF EXISTS note_length CASCADE;
-- ALTER TABLE mood_entries DROP COLUMN IF EXISTS session_duration_ms CASCADE;
-- ALTER TABLE mood_entries DROP COLUMN IF EXISTS xp_earned CASCADE;
-- ALTER TABLE mood_entries DROP COLUMN IF EXISTS achievements_earned CASCADE;
-- DROP FUNCTION IF EXISTS update_user_stats_timestamp() CASCADE;

-- ===================================================================
-- END OF MIGRATIONS
-- ===================================================================
