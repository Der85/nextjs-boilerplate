-- ADHDer.io Phase 1 Schema
-- Location-gated microblogging platform
-- Run this in the Supabase SQL editor

-- ============================================================
-- Drop old task-management schema (from previous app version)
-- CASCADE handles FK dependencies automatically
-- ============================================================

DROP TABLE IF EXISTS public.weekly_reviews         CASCADE;
DROP TABLE IF EXISTS public.balance_scores         CASCADE;
DROP TABLE IF EXISTS public.smart_reminders        CASCADE;
DROP TABLE IF EXISTS public.task_suggestions       CASCADE;
DROP TABLE IF EXISTS public.user_priorities        CASCADE;
DROP TABLE IF EXISTS public.task_templates         CASCADE;
DROP TABLE IF EXISTS public.user_insights          CASCADE;
DROP TABLE IF EXISTS public.ai_category_suggestions CASCADE;
DROP TABLE IF EXISTS public.tasks                  CASCADE;
DROP TABLE IF EXISTS public.categories             CASCADE;
DROP TABLE IF EXISTS public.user_profiles          CASCADE;

-- Drop old trigger + function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE public.profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle       TEXT        UNIQUE NOT NULL,
  display_name TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Zone metadata. Populated by the /api/geo/resolve route.
-- zone_id is an H3 cell index string (not an integer FK),
-- so posts reference it as a plain text column, not a FK.
CREATE TABLE public.zones (
  zone_id           TEXT        PRIMARY KEY,
  label             TEXT        NOT NULL,
  resolution        INT         NOT NULL DEFAULT 8,
  active_user_count INT         NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.posts (
  id         UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  UUID            NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT            NOT NULL CHECK (char_length(content) <= 280),
  latitude   DOUBLE PRECISION NOT NULL,
  longitude  DOUBLE PRECISION NOT NULL,
  h3_index   TEXT            NOT NULL,  -- H3 cell at resolution 8
  zone_label TEXT            NOT NULL,
  zone_id    TEXT            NOT NULL REFERENCES public.zones(zone_id),
  parent_id  UUID            REFERENCES public.posts(id) ON DELETE CASCADE,   -- NULL = top-level; CASCADE deletes replies with parent
  repost_of  UUID            REFERENCES public.posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Users subscribe to location zones (their "following" feed sources)
CREATE TABLE public.location_follows (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  zone_id    TEXT        NOT NULL,
  zone_label TEXT        NOT NULL,  -- snapshot of label at follow time
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, zone_id)
);

-- ============================================================
-- Indexes
-- ============================================================

-- Feed queries are sorted by zone + time DESC
CREATE INDEX idx_posts_zone_id    ON public.posts(zone_id, created_at DESC);
CREATE INDEX idx_posts_author_id  ON public.posts(author_id, created_at DESC);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_h3_index   ON public.posts(h3_index);
CREATE INDEX idx_posts_parent_id  ON public.posts(parent_id, created_at DESC);

CREATE INDEX idx_location_follows_user_id ON public.location_follows(user_id);
CREATE INDEX idx_location_follows_zone_id ON public.location_follows(zone_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_follows ENABLE ROW LEVEL SECURITY;

-- Posts: globally readable, only authenticated users can insert their own
CREATE POLICY "posts_public_read"
  ON public.posts FOR SELECT
  USING (true);

CREATE POLICY "posts_authenticated_insert"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "posts_self_delete"
  ON public.posts FOR DELETE
  USING (auth.uid() = author_id);

-- Profiles: globally readable, users update their own row
CREATE POLICY "profiles_public_read"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_self_insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_self_update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Zones: globally readable, server-side upsert from /api/geo/resolve
-- (route uses server client which has authenticated role via user session)
CREATE POLICY "zones_public_read"
  ON public.zones FOR SELECT
  USING (true);

CREATE POLICY "zones_authenticated_insert"
  ON public.zones FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "zones_authenticated_update"
  ON public.zones FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Location follows: users manage their own subscriptions only
CREATE POLICY "location_follows_self_select"
  ON public.location_follows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "location_follows_self_insert"
  ON public.location_follows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "location_follows_self_delete"
  ON public.location_follows FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Profile auto-creation trigger
-- Fires on every new auth.users row. If the signup page has already
-- inserted a profile (with a chosen handle), the ON CONFLICT DO NOTHING
-- ensures this trigger is a safe no-op.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  base_handle  TEXT;
  final_handle TEXT;
  counter      INT := 0;
BEGIN
  -- Derive handle from email prefix
  base_handle := split_part(NEW.email, '@', 1);
  -- Keep only alphanumeric + underscores, lowercase
  base_handle := lower(regexp_replace(base_handle, '[^a-zA-Z0-9_]', '_', 'g'));
  -- Enforce 3-char minimum and 20-char maximum
  base_handle := left(CASE WHEN length(base_handle) < 3 THEN base_handle || 'usr' ELSE base_handle END, 20);
  final_handle := base_handle;

  -- Ensure uniqueness with a numeric suffix if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = final_handle) LOOP
    counter      := counter + 1;
    final_handle := left(base_handle, 17) || '_' || counter::TEXT;
  END LOOP;

  -- No-op if signup page already inserted the profile row with a chosen handle
  INSERT INTO public.profiles (id, handle, display_name)
  VALUES (NEW.id, final_handle, final_handle)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
