-- ============================
-- User Priorities
-- Life priority ranking for ADHD users
-- ============================

-- Main priorities table: stores user's ranked life domains
CREATE TABLE IF NOT EXISTS user_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain text NOT NULL, -- matches category names: 'Work', 'Health', 'Home', 'Finance', 'Social', 'Personal Growth', 'Admin', 'Family'
  rank integer NOT NULL CHECK (rank >= 1 AND rank <= 8), -- 1 = highest priority, 8 = lowest
  importance_score integer NOT NULL DEFAULT 5 CHECK (importance_score >= 1 AND importance_score <= 10), -- 1-10 scale
  aspirational_note text, -- user's own words: "I want to exercise 3x/week"
  last_reviewed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, domain),
  UNIQUE(user_id, rank)
);

COMMENT ON TABLE user_priorities IS 'User life priorities ranked by importance - foundation for AI suggestions and balance scoring';
COMMENT ON COLUMN user_priorities.domain IS 'Life domain matching system category names';
COMMENT ON COLUMN user_priorities.rank IS '1 = highest priority, 8 = lowest';
COMMENT ON COLUMN user_priorities.importance_score IS '1-10 intensity scale - allows nuanced weighting beyond just rank';
COMMENT ON COLUMN user_priorities.aspirational_note IS 'User-defined success criteria in their own words';
COMMENT ON COLUMN user_priorities.last_reviewed_at IS 'When user last confirmed or updated this priority';

-- Enable RLS
ALTER TABLE user_priorities ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own priorities" ON user_priorities
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own priorities" ON user_priorities
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own priorities" ON user_priorities
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own priorities" ON user_priorities
  FOR DELETE USING (auth.uid() = user_id);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_priorities_user ON user_priorities(user_id);
CREATE INDEX IF NOT EXISTS idx_priorities_user_rank ON user_priorities(user_id, rank);

-- Auto-update updated_at trigger
CREATE TRIGGER user_priorities_updated_at BEFORE UPDATE ON user_priorities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================
-- Priority Reviews
-- Tracks when user revisits their priorities (for quarterly prompts)
-- ============================

CREATE TABLE IF NOT EXISTS priority_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_rankings jsonb NOT NULL, -- snapshot of rankings before this review
  new_rankings jsonb NOT NULL, -- snapshot after
  trigger text NOT NULL CHECK (trigger IN ('onboarding', 'quarterly_prompt', 'manual', 'life_event')),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE priority_reviews IS 'Audit log of priority changes - helps track life transitions over time';
COMMENT ON COLUMN priority_reviews.previous_rankings IS 'Snapshot of domain rankings before review';
COMMENT ON COLUMN priority_reviews.new_rankings IS 'Snapshot of domain rankings after review';
COMMENT ON COLUMN priority_reviews.trigger IS 'What prompted this review: onboarding, quarterly_prompt, manual, or life_event';

-- Enable RLS
ALTER TABLE priority_reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own reviews" ON priority_reviews
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reviews" ON priority_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_priority_reviews_user ON priority_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_priority_reviews_user_created ON priority_reviews(user_id, created_at DESC);
