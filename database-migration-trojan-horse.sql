-- ============================================
-- Migration: Trojan Horse Data Collection
-- Makes burnout_logs columns nullable for partial records
-- Adds source tracking and battery_level column
-- ============================================

-- Step 1: Make all 9 measurement columns nullable
-- This allows partial records from different data sources
ALTER TABLE burnout_logs ALTER COLUMN sleep_quality DROP NOT NULL;
ALTER TABLE burnout_logs ALTER COLUMN energy_level DROP NOT NULL;
ALTER TABLE burnout_logs ALTER COLUMN physical_tension DROP NOT NULL;
ALTER TABLE burnout_logs ALTER COLUMN irritability DROP NOT NULL;
ALTER TABLE burnout_logs ALTER COLUMN overwhelm DROP NOT NULL;
ALTER TABLE burnout_logs ALTER COLUMN motivation DROP NOT NULL;
ALTER TABLE burnout_logs ALTER COLUMN focus_difficulty DROP NOT NULL;
ALTER TABLE burnout_logs ALTER COLUMN forgetfulness DROP NOT NULL;
ALTER TABLE burnout_logs ALTER COLUMN decision_fatigue DROP NOT NULL;

-- Step 2: Make computed columns nullable too
ALTER TABLE burnout_logs ALTER COLUMN total_score DROP NOT NULL;
ALTER TABLE burnout_logs ALTER COLUMN severity_level DROP NOT NULL;

-- Step 3: Add source column to track where data came from
-- Values: 'full_assessment', 'smart_battery', 'morning_key', 'evening_winddown', 'focus_survey', 'rescue_inference'
ALTER TABLE burnout_logs ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'full_assessment';

-- Step 4: Add battery_level for Smart Battery feature (0-100)
ALTER TABLE burnout_logs ADD COLUMN IF NOT EXISTS battery_level INT;

-- Step 5: Index on source for efficient filtering
CREATE INDEX IF NOT EXISTS idx_burnout_logs_source ON burnout_logs(source);

-- Step 6: Index on user_id + created_at + source for "last known value" queries
CREATE INDEX IF NOT EXISTS idx_burnout_logs_user_source ON burnout_logs(user_id, created_at DESC, source);
