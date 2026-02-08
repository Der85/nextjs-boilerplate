-- Migration 013: Create analytics_events table
-- Lightweight event tracking for beta testing

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  properties jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);

-- Index for querying by event name
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_event ON analytics_events(user_id, event_name, created_at DESC);

-- Enable RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own events
CREATE POLICY "Users can insert own events"
  ON analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can read their own events (for debugging)
CREATE POLICY "Users can read own events"
  ON analytics_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Service role can read all events (for analytics dashboards)
CREATE POLICY "Service role can read all events"
  ON analytics_events
  FOR SELECT
  TO service_role
  USING (true);

-- Rollback:
-- DROP TABLE IF EXISTS analytics_events;
