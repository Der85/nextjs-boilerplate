-- Migration: Local Pulse AI-generated posts
-- Run in: Supabase Dashboard → SQL Editor

-- 1. Add AI post fields to the posts table
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_url       TEXT;

-- 2. Index to efficiently find recent bot posts per zone (used by cron dedup check)
CREATE INDEX IF NOT EXISTS posts_ai_generated_zone_created
  ON public.posts (author_id, zone_id, created_at DESC)
  WHERE is_ai_generated = TRUE;

-- 3. Create the Local Pulse bot profile
--    Replace <BOT_USER_UUID> with the UUID from Supabase Auth after creating the bot account.
--    Create the auth user first:
--      Supabase Dashboard → Authentication → Users → Add user
--      Email: localpulse@adhder.io  Password: (strong random password, never shared)
--    Then copy the UUID and run:
--
-- INSERT INTO public.profiles (id, handle, display_name, created_at)
-- VALUES (
--   '<BOT_USER_UUID>',
--   'local_pulse',
--   'Local Pulse',
--   NOW()
-- )
-- ON CONFLICT (id) DO NOTHING;

-- 4. RLS: the bot uses the service-role key (bypasses RLS), so no extra policies needed.
--    But we do want to make sure AI posts are readable by everyone (they already are
--    via the existing posts_select_authenticated policy).
