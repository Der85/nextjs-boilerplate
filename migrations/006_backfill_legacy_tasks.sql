-- ===================================================================
-- Migration 006: Backfill Legacy Tasks with General Maintenance Outcome
-- ===================================================================
-- Creates a "General Maintenance" outcome for each user who has
-- unlinked tasks, then links those tasks to it.
-- ===================================================================
-- Run: Supabase Dashboard > SQL Editor > New Query
-- Prerequisites: Migrations 003-005 must be run first
-- ===================================================================
-- NOTE: This migration is IDEMPOTENT - safe to run multiple times
-- ===================================================================

-- ===================================================================
-- STEP 1: Create General Maintenance outcomes for users with unlinked tasks
-- ===================================================================

INSERT INTO outcomes (user_id, title, description, horizon, status, priority_rank)
SELECT DISTINCT
  fp.user_id,
  'General Maintenance',
  'Tasks created before outcome tracking was enabled. Review and reassign to specific outcomes.',
  'monthly',
  'active',
  999  -- Low priority to encourage relinking
FROM focus_plans fp
WHERE fp.outcome_id IS NULL
  AND fp.commitment_id IS NULL
  AND fp.status NOT IN ('completed', 'parked')  -- Only for active-ish tasks
  AND NOT EXISTS (
    -- Don't create duplicate General Maintenance outcomes
    SELECT 1 FROM outcomes o
    WHERE o.user_id = fp.user_id
    AND o.title = 'General Maintenance'
  );

-- ===================================================================
-- STEP 2: Link unlinked tasks to their user's General Maintenance outcome
-- ===================================================================

UPDATE focus_plans fp
SET outcome_id = (
  SELECT o.id FROM outcomes o
  WHERE o.user_id = fp.user_id
  AND o.title = 'General Maintenance'
  LIMIT 1
)
WHERE fp.outcome_id IS NULL
  AND fp.commitment_id IS NULL
  AND fp.status NOT IN ('completed', 'parked')
  AND EXISTS (
    SELECT 1 FROM outcomes o
    WHERE o.user_id = fp.user_id
    AND o.title = 'General Maintenance'
  );

-- ===================================================================
-- STEP 3: Also link completed/parked tasks for historical consistency
-- ===================================================================

UPDATE focus_plans fp
SET outcome_id = (
  SELECT o.id FROM outcomes o
  WHERE o.user_id = fp.user_id
  AND o.title = 'General Maintenance'
  LIMIT 1
)
WHERE fp.outcome_id IS NULL
  AND fp.commitment_id IS NULL
  AND fp.status IN ('completed', 'parked')
  AND EXISTS (
    SELECT 1 FROM outcomes o
    WHERE o.user_id = fp.user_id
    AND o.title = 'General Maintenance'
  );

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================
-- Run these to verify the backfill worked:

-- Check how many General Maintenance outcomes were created
-- SELECT COUNT(*) as gm_outcomes_count FROM outcomes WHERE title = 'General Maintenance';

-- Check task counts per outcome
-- SELECT
--   o.title,
--   o.user_id,
--   COUNT(fp.id) as task_count
-- FROM outcomes o
-- LEFT JOIN focus_plans fp ON fp.outcome_id = o.id
-- WHERE o.title = 'General Maintenance'
-- GROUP BY o.id, o.title, o.user_id;

-- Check for any remaining unlinked active tasks (should be 0)
-- SELECT COUNT(*) as unlinked_active_tasks
-- FROM focus_plans
-- WHERE outcome_id IS NULL
--   AND commitment_id IS NULL
--   AND status NOT IN ('completed', 'parked');

-- ===================================================================
-- ROLLBACK
-- ===================================================================
-- To rollback this migration, run:
--
-- -- Step 1: Unlink tasks from General Maintenance
-- UPDATE focus_plans
-- SET outcome_id = NULL
-- WHERE outcome_id IN (
--   SELECT id FROM outcomes WHERE title = 'General Maintenance'
-- );
--
-- -- Step 2: Delete General Maintenance outcomes
-- DELETE FROM outcomes WHERE title = 'General Maintenance';

-- ===================================================================
-- END OF MIGRATION 006
-- ===================================================================
