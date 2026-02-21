-- ============================
-- Atomic Operations
-- RPC functions for race-condition-safe counter increments
-- and multi-step transactional writes
-- ============================

-- Atomic template use_count increment
-- Avoids read-then-write race condition
CREATE OR REPLACE FUNCTION increment_template_use_count(template_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE task_templates
  SET use_count = use_count + 1,
      last_used_at = now()
  WHERE id = template_id
    AND user_id = auth.uid();
$$;

COMMENT ON FUNCTION increment_template_use_count IS 'Atomically increment template use_count - prevents lost updates under concurrency';

-- Atomic upsert for user priorities
-- Replaces the delete-then-insert pattern with a single transaction
CREATE OR REPLACE FUNCTION upsert_priorities(
  p_priorities jsonb,
  p_trigger text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing jsonb;
  v_result jsonb;
  v_now timestamptz := now();
BEGIN
  -- Snapshot existing priorities for review record
  SELECT jsonb_agg(
    jsonb_build_object(
      'domain', domain,
      'rank', rank,
      'importance_score', importance_score,
      'aspirational_note', aspirational_note
    ) ORDER BY rank
  )
  INTO v_existing
  FROM user_priorities
  WHERE user_id = v_user_id;

  -- Delete existing and insert new in one transaction
  DELETE FROM user_priorities WHERE user_id = v_user_id;

  INSERT INTO user_priorities (user_id, domain, rank, importance_score, aspirational_note, last_reviewed_at)
  SELECT
    v_user_id,
    (p->>'domain')::text,
    (p->>'rank')::integer,
    (p->>'importance_score')::integer,
    p->>'aspirational_note',
    v_now
  FROM jsonb_array_elements(p_priorities) AS p;

  -- Create review record if we had existing priorities
  IF v_existing IS NOT NULL THEN
    INSERT INTO priority_reviews (user_id, previous_rankings, new_rankings, trigger)
    VALUES (v_user_id, v_existing, p_priorities, p_trigger);
  END IF;

  -- Return the inserted priorities
  SELECT jsonb_agg(row_to_json(up.*) ORDER BY up.rank)
  INTO v_result
  FROM user_priorities up
  WHERE up.user_id = v_user_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION upsert_priorities IS 'Atomically replace all user priorities in a single transaction - prevents partial state from concurrent requests';
