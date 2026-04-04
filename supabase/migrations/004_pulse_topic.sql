-- Migration: Add pulse_topic to posts for Local Pulse topic-specific icons
-- Run in: Supabase Dashboard → SQL Editor

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS pulse_topic text
  CHECK (pulse_topic IS NULL OR pulse_topic IN (
    'weather', 'air_quality', 'new_place', 'local_knowledge', 'daylight'
  ));
