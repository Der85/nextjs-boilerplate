-- ============================
-- ADHDer.io v2 Fresh Schema
-- ============================

-- 1. user_profiles
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  timezone text DEFAULT 'UTC',
  onboarded_at timestamptz,
  category_suggestions_accepted boolean DEFAULT false,
  total_tasks_created integer DEFAULT 0,
  total_tasks_completed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON user_profiles FOR DELETE USING (auth.uid() = id);

-- 2. dumps
CREATE TABLE dumps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  source text NOT NULL DEFAULT 'text' CHECK (source IN ('text', 'voice')),
  task_count integer DEFAULT 0,
  ai_model text,
  ai_latency_ms integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dumps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own dumps" ON dumps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own dumps" ON dumps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own dumps" ON dumps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own dumps" ON dumps FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_dumps_user ON dumps(user_id);

-- 3. categories
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  icon text DEFAULT '📁',
  position integer DEFAULT 0,
  is_ai_generated boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON categories FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_categories_user ON categories(user_id);

-- 4. tasks
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'dropped')),
  due_date date,
  due_time time,
  priority text CHECK (priority IN ('low', 'medium', 'high')),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  dump_id uuid REFERENCES dumps(id) ON DELETE SET NULL,
  original_fragment text,
  ai_confidence numeric(3,2) DEFAULT 1.0,
  position integer DEFAULT 0,
  completed_at timestamptz,
  dropped_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_user_due ON tasks(user_id, due_date) WHERE status = 'active';
CREATE INDEX idx_tasks_user_category ON tasks(user_id, category_id) WHERE status != 'dropped';
CREATE INDEX idx_tasks_user_completed ON tasks(user_id, completed_at) WHERE status = 'done';

-- 5. category_suggestions
CREATE TABLE category_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_type text NOT NULL CHECK (suggestion_type IN ('initial', 'evolution')),
  suggested_categories jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  task_count_at_suggestion integer,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE category_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own suggestions" ON category_suggestions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own suggestions" ON category_suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own suggestions" ON category_suggestions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own suggestions" ON category_suggestions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_category_suggestions_user ON category_suggestions(user_id) WHERE status = 'pending';

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
