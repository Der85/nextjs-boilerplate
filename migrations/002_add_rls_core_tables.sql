-- ===================================================================
-- Migration: Add Row Level Security (RLS) to Core Tables
-- ===================================================================
-- IMPORTANT: Run this migration on your Supabase database to secure data
-- Go to: Supabase Dashboard > SQL Editor > New Query
-- Paste this entire file and execute
-- ===================================================================
-- NOTE: Uses DROP POLICY IF EXISTS to handle re-running safely
-- ===================================================================

-- ===================================================================
-- FOCUS_PLANS TABLE
-- ===================================================================

ALTER TABLE focus_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own focus_plans" ON focus_plans;
CREATE POLICY "Users can view own focus_plans"
  ON focus_plans
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own focus_plans" ON focus_plans;
CREATE POLICY "Users can insert own focus_plans"
  ON focus_plans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own focus_plans" ON focus_plans;
CREATE POLICY "Users can update own focus_plans"
  ON focus_plans
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own focus_plans" ON focus_plans;
CREATE POLICY "Users can delete own focus_plans"
  ON focus_plans
  FOR DELETE
  USING (auth.uid() = user_id);

-- ===================================================================
-- MOOD_ENTRIES TABLE
-- ===================================================================

ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own mood_entries" ON mood_entries;
CREATE POLICY "Users can view own mood_entries"
  ON mood_entries
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own mood_entries" ON mood_entries;
CREATE POLICY "Users can insert own mood_entries"
  ON mood_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own mood_entries" ON mood_entries;
CREATE POLICY "Users can update own mood_entries"
  ON mood_entries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own mood_entries" ON mood_entries;
CREATE POLICY "Users can delete own mood_entries"
  ON mood_entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- ===================================================================
-- GOALS TABLE
-- ===================================================================

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own goals" ON goals;
CREATE POLICY "Users can view own goals"
  ON goals
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goals" ON goals;
CREATE POLICY "Users can insert own goals"
  ON goals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goals" ON goals;
CREATE POLICY "Users can update own goals"
  ON goals
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own goals" ON goals;
CREATE POLICY "Users can delete own goals"
  ON goals
  FOR DELETE
  USING (auth.uid() = user_id);

-- ===================================================================
-- GOAL_PROGRESS_LOGS TABLE
-- ===================================================================

ALTER TABLE goal_progress_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own goal_progress_logs" ON goal_progress_logs;
CREATE POLICY "Users can view own goal_progress_logs"
  ON goal_progress_logs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goal_progress_logs" ON goal_progress_logs;
CREATE POLICY "Users can insert own goal_progress_logs"
  ON goal_progress_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goal_progress_logs" ON goal_progress_logs;
CREATE POLICY "Users can update own goal_progress_logs"
  ON goal_progress_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own goal_progress_logs" ON goal_progress_logs;
CREATE POLICY "Users can delete own goal_progress_logs"
  ON goal_progress_logs
  FOR DELETE
  USING (auth.uid() = user_id);

-- ===================================================================
-- BURNOUT_LOGS TABLE
-- ===================================================================

ALTER TABLE burnout_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own burnout_logs" ON burnout_logs;
CREATE POLICY "Users can view own burnout_logs"
  ON burnout_logs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own burnout_logs" ON burnout_logs;
CREATE POLICY "Users can insert own burnout_logs"
  ON burnout_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own burnout_logs" ON burnout_logs;
CREATE POLICY "Users can update own burnout_logs"
  ON burnout_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own burnout_logs" ON burnout_logs;
CREATE POLICY "Users can delete own burnout_logs"
  ON burnout_logs
  FOR DELETE
  USING (auth.uid() = user_id);

-- ===================================================================
-- ALLY_SESSIONS TABLE
-- ===================================================================

ALTER TABLE ally_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ally_sessions" ON ally_sessions;
CREATE POLICY "Users can view own ally_sessions"
  ON ally_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own ally_sessions" ON ally_sessions;
CREATE POLICY "Users can insert own ally_sessions"
  ON ally_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own ally_sessions" ON ally_sessions;
CREATE POLICY "Users can update own ally_sessions"
  ON ally_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ===================================================================
-- STUCK_COMMITMENTS TABLE
-- ===================================================================

ALTER TABLE stuck_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own stuck_commitments" ON stuck_commitments;
CREATE POLICY "Users can view own stuck_commitments"
  ON stuck_commitments
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own stuck_commitments" ON stuck_commitments;
CREATE POLICY "Users can insert own stuck_commitments"
  ON stuck_commitments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own stuck_commitments" ON stuck_commitments;
CREATE POLICY "Users can update own stuck_commitments"
  ON stuck_commitments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================
-- Run these to verify RLS is enabled and policies exist

-- Check which tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('focus_plans', 'mood_entries', 'goals', 'goal_progress_logs', 'burnout_logs', 'ally_sessions', 'stuck_commitments');

-- Check policies on these tables
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('focus_plans', 'mood_entries', 'goals', 'goal_progress_logs', 'burnout_logs', 'ally_sessions', 'stuck_commitments');

-- ===================================================================
-- NOTES
-- ===================================================================
-- 1. These policies use auth.uid() which returns the currently authenticated user's ID
-- 2. All policies require the user_id column to match auth.uid()
-- 3. The anonymous key can still query the database, but will only see rows
--    where user_id matches the authenticated user's JWT
-- 4. Service role key bypasses RLS - use only on server-side when needed
-- 5. If a table doesn't exist yet, those ALTER TABLE statements will fail gracefully
--    Just re-run after creating the missing tables

-- ===================================================================
-- END OF MIGRATION
-- ===================================================================
