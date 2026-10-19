-- ============================================================
-- The Big Pitch — Enable Supabase Realtime Replication & Publications
-- Migration: 008_enable_realtime_replication.sql
-- Run in: Supabase SQL Editor
-- ============================================================

-- 1. Ensure REPLICA IDENTITY is set to FULL for CDC row-level changes
ALTER TABLE IF EXISTS public.teams REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.pitch_rounds REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.wallets REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.investments REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.event_config REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.events REPLICA IDENTITY FULL;

-- 2. Add tables to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'teams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'pitch_rounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pitch_rounds;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'wallets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'investments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.investments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'event_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_config;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  END IF;
END $$;

-- 3. Ensure Row-Level Security policies allow realtime SELECT for public / audience
DROP POLICY IF EXISTS "Allow public read on teams" ON public.teams;
CREATE POLICY "Allow public read on teams" ON public.teams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on pitch_rounds" ON public.pitch_rounds;
CREATE POLICY "Allow public read on pitch_rounds" ON public.pitch_rounds FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on events" ON public.events;
CREATE POLICY "Allow public read on events" ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on event_config" ON public.event_config;
CREATE POLICY "Allow public read on event_config" ON public.event_config FOR SELECT USING (true);
