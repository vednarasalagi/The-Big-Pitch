-- Migration 005: Audience Investor Winner & Timing in Milliseconds
-- Adds time_elapsed_ms to investments to track investment reaction time in milliseconds.

ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS time_elapsed_ms BIGINT DEFAULT 0;

-- Ensure read access to investments for live leaderboard and stage casting calculations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'investments' AND policyname = 'Allow all to view investments for standings'
  ) THEN
    CREATE POLICY "Allow all to view investments for standings"
    ON public.investments FOR SELECT
    USING (true);
  END IF;
END $$;
