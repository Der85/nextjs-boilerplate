-- ============================
-- ADHDer.io Microblogging Schema
-- Location-gated posts, zones, follows
-- ============================

-- 1. User profiles for microblogging
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text UNIQUE,
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT handle_format CHECK (handle ~ '^[a-z0-9_]{3,20}$'),
  CONSTRAINT bio_length CHECK (char_length(bio) <= 160)
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are publicly readable" ON user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE INDEX IF NOT EXISTS idx_profiles_handle ON user_profiles(handle);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Zones — H3 hex cells with human-readable labels
CREATE TABLE zones (
  id text PRIMARY KEY,                     -- H3 cell index string
  label text NOT NULL,                     -- human-readable name or H3 index placeholder
  h3_resolution integer NOT NULL DEFAULT 7,
  lat double precision NOT NULL DEFAULT 0,
  lng double precision NOT NULL DEFAULT 0,
  post_count integer NOT NULL DEFAULT 0,
  follower_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
-- Zones are readable by all authenticated users
CREATE POLICY "Zones are publicly readable" ON zones FOR SELECT
  USING (auth.role() = 'authenticated');
-- Zones are created via the API (service-level insert via authenticated user)
CREATE POLICY "Authenticated users can create zones" ON zones FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update zones" ON zones FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 3. Posts — 280-char microblog entries tagged with location
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zone_id text NOT NULL REFERENCES zones(id),
  body text NOT NULL CHECK (char_length(body) <= 280),
  parent_id uuid REFERENCES posts(id) ON DELETE CASCADE,   -- NULL = top-level, set = reply
  repost_of uuid REFERENCES posts(id) ON DELETE SET NULL,  -- NULL = original, set = repost
  reply_count integer NOT NULL DEFAULT 0,
  repost_count integer NOT NULL DEFAULT 0,
  lat double precision,
  lng double precision,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
-- All authenticated users can read posts (global read)
CREATE POLICY "Posts are readable by authenticated users" ON posts FOR SELECT
  USING (auth.role() = 'authenticated');
-- Users can only insert their own posts
CREATE POLICY "Users can create own posts" ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
-- Users can only delete their own posts
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_posts_zone ON posts(zone_id, created_at DESC);
CREATE INDEX idx_posts_user ON posts(user_id, created_at DESC);
CREATE INDEX idx_posts_parent ON posts(parent_id, created_at DESC);

-- 4. Location follows — subscribe to zones
CREATE TABLE location_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zone_id text NOT NULL REFERENCES zones(id),
  zone_label text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, zone_id)
);

ALTER TABLE location_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own follows" ON location_follows FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create own follows" ON location_follows FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own follows" ON location_follows FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_follows_user ON location_follows(user_id);

-- 5. Helper function: increment reply_count on parent post
CREATE OR REPLACE FUNCTION increment_reply_count(post_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE posts SET reply_count = reply_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger: auto-increment zone post_count on new post
CREATE OR REPLACE FUNCTION update_zone_post_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE zones SET post_count = post_count + 1 WHERE id = NEW.zone_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE zones SET post_count = GREATEST(post_count - 1, 0) WHERE id = OLD.zone_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_zone_post_count
AFTER INSERT OR DELETE ON posts
FOR EACH ROW EXECUTE FUNCTION update_zone_post_count();

-- 7. Trigger: auto-update zone follower_count
CREATE OR REPLACE FUNCTION update_zone_follower_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE zones SET follower_count = follower_count + 1 WHERE id = NEW.zone_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE zones SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.zone_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_zone_follower_count
AFTER INSERT OR DELETE ON location_follows
FOR EACH ROW EXECUTE FUNCTION update_zone_follower_count();
