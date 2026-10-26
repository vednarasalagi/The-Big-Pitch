-- ============================================================
-- Migration 019: Fix Pitch Rounds RLS and Stage Control Authority
-- Guarantees that starting pitches and opening investment windows
-- immediately and authoritatively syncs to all audience devices.
-- ============================================================

-- 1. Ensure pitch_rounds table allows stage control writes
ALTER TABLE public.pitch_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rounds_admin_write" ON public.pitch_rounds;
DROP POLICY IF EXISTS "rounds_public_read" ON public.pitch_rounds;
DROP POLICY IF EXISTS "Allow public read on pitch_rounds" ON public.pitch_rounds;
DROP POLICY IF EXISTS "pitch_rounds_all_read" ON public.pitch_rounds;
DROP POLICY IF EXISTS "pitch_rounds_stage_control" ON public.pitch_rounds;

CREATE POLICY "pitch_rounds_all_read" ON public.pitch_rounds
  FOR SELECT USING (true);

CREATE POLICY "pitch_rounds_stage_control" ON public.pitch_rounds
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Ensure teams table allows stage control writes
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "teams_admin_write" ON public.teams;
DROP POLICY IF EXISTS "teams_public_read" ON public.teams;
DROP POLICY IF EXISTS "Allow public read on teams" ON public.teams;
DROP POLICY IF EXISTS "teams_stage_control" ON public.teams;

CREATE POLICY "teams_public_read" ON public.teams
  FOR SELECT USING (true);

CREATE POLICY "teams_stage_control" ON public.teams
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Ensure pitch_rounds and teams are on the Supabase Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'pitch_rounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pitch_rounds;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'teams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
  END IF;
END $$;

-- 4. Authoritative Server RPC: Start Pitch Round
CREATE OR REPLACE FUNCTION public.admin_start_pitch_round(
  p_event_id UUID,
  p_team_id UUID,
  p_pitch_duration INT DEFAULT 300,
  p_investment_window INT DEFAULT 180,
  p_phase TEXT DEFAULT 'announced'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_round RECORD;
  v_team RECORD;
  v_open_time TIMESTAMPTZ;
  v_close_time TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Validate phase
  IF p_phase NOT IN ('announced', 'pitching', 'investment_open') THEN
    p_phase := 'announced';
  END IF;

  IF p_phase = 'investment_open' THEN
    v_open_time := v_now;
    v_close_time := v_now + (COALESCE(p_investment_window, 180) || ' seconds')::INTERVAL;
  ELSE
    v_open_time := NULL;
    v_close_time := NULL;
  END IF;

  -- 1. Complete all existing active, closed, or paused rounds
  UPDATE public.pitch_rounds
  SET status = 'completed', updated_at = v_now
  WHERE event_id = p_event_id
    AND status IN ('announced', 'pitching', 'investment_open', 'investment_paused', 'investment_closed');

  -- 2. Activate the team
  UPDATE public.teams
  SET status = 'active', updated_at = v_now
  WHERE id = p_team_id
  RETURNING * INTO v_team;

  -- 3. Insert new pitch round
  INSERT INTO public.pitch_rounds (
    event_id,
    team_id,
    status,
    pitch_start_time,
    investment_open_time,
    investment_close_time,
    scheduled_duration_seconds,
    investment_window_seconds,
    total_invested,
    unique_investors,
    created_at,
    updated_at
  ) VALUES (
    p_event_id,
    p_team_id,
    p_phase,
    v_now,
    v_open_time,
    v_close_time,
    COALESCE(p_pitch_duration, 300),
    COALESCE(p_investment_window, 180),
    COALESCE(v_team.total_investment, 0),
    COALESCE(v_team.unique_backers, 0),
    v_now,
    v_now
  )
  RETURNING * INTO v_round;

  RETURN jsonb_build_object(
    'success', true,
    'round', jsonb_build_object(
      'id', v_round.id,
      'eventId', v_round.event_id,
      'teamId', v_round.team_id,
      'status', v_round.status,
      'pitchStartTime', v_round.pitch_start_time,
      'investmentOpenTime', v_round.investment_open_time,
      'investmentCloseTime', v_round.investment_close_time,
      'scheduledDurationSeconds', v_round.scheduled_duration_seconds,
      'investmentWindowSeconds', v_round.investment_window_seconds,
      'totalInvested', v_round.total_invested,
      'uniqueInvestors', v_round.unique_investors,
      'createdAt', v_round.created_at,
      'updatedAt', v_round.updated_at,
      'roundNumber', COALESCE(v_team.pitch_order, 1),
      'team', jsonb_build_object(
        'id', v_team.id,
        'eventId', v_team.event_id,
        'name', v_team.name,
        'logoUrl', v_team.logo_url,
        'pitchTitle', v_team.pitch_title,
        'description', v_team.description,
        'category', v_team.category,
        'presenters', v_team.presenters,
        'pitchOrder', v_team.pitch_order,
        'status', v_team.status,
        'totalInvestment', v_team.total_investment,
        'uniqueBackers', v_team.unique_backers
      )
    )
  );
END;
$$;

-- 5. Authoritative Server RPC: Open Audience Investment Window
CREATE OR REPLACE FUNCTION public.admin_open_investment_window(
  p_round_id UUID,
  p_duration_seconds INT DEFAULT 180
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_round RECORD;
  v_team RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_close_time TIMESTAMPTZ;
  v_duration INT := COALESCE(p_duration_seconds, 180);
BEGIN
  v_close_time := v_now + (v_duration || ' seconds')::INTERVAL;

  UPDATE public.pitch_rounds
  SET status = 'investment_open',
      investment_open_time = v_now,
      investment_close_time = v_close_time,
      investment_pause_time = NULL,
      investment_window_seconds = v_duration,
      updated_at = v_now
  WHERE id = p_round_id
  RETURNING * INTO v_round;

  IF v_round.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pitch round not found');
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = v_round.team_id;

  RETURN jsonb_build_object(
    'success', true,
    'round', jsonb_build_object(
      'id', v_round.id,
      'eventId', v_round.event_id,
      'teamId', v_round.team_id,
      'status', v_round.status,
      'pitchStartTime', v_round.pitch_start_time,
      'investmentOpenTime', v_round.investment_open_time,
      'investmentCloseTime', v_round.investment_close_time,
      'scheduledDurationSeconds', v_round.scheduled_duration_seconds,
      'investmentWindowSeconds', v_round.investment_window_seconds,
      'totalInvested', v_round.total_invested,
      'uniqueInvestors', v_round.unique_investors,
      'createdAt', v_round.created_at,
      'updatedAt', v_round.updated_at,
      'roundNumber', COALESCE(v_team.pitch_order, 1),
      'team', jsonb_build_object(
        'id', v_team.id,
        'eventId', v_team.event_id,
        'name', v_team.name,
        'logoUrl', v_team.logo_url,
        'pitchTitle', v_team.pitch_title,
        'description', v_team.description,
        'category', v_team.category,
        'presenters', v_team.presenters,
        'pitchOrder', v_team.pitch_order,
        'status', v_team.status,
        'totalInvestment', v_team.total_investment,
        'uniqueBackers', v_team.unique_backers
      )
    )
  );
END;
$$;

-- 6. Authoritative Server RPC: Close Investment Window
CREATE OR REPLACE FUNCTION public.admin_close_investment_window(
  p_round_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  UPDATE public.pitch_rounds
  SET status = 'investment_closed',
      updated_at = NOW()
  WHERE id = p_round_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. Add authorized administrators into allowlist and update profiles
ALTER TABLE public.admin_allowlist 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

INSERT INTO public.admin_allowlist (email, role, added_by, notes, updated_at)
VALUES 
  ('callforved@gmail.com', 'admin', 'system', 'Authorized Administrator', NOW()),
  ('vednarasalagi@gmail.com', 'admin', 'system', 'Primary Super Admin', NOW())
ON CONFLICT (email) DO UPDATE SET role = 'admin', updated_at = NOW();

UPDATE public.profiles
SET role = 'admin', entry_verified = TRUE, updated_at = NOW()
WHERE LOWER(email) IN ('callforved@gmail.com', 'vednarasalagi@gmail.com');
