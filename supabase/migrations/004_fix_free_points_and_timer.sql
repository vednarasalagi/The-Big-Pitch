-- ============================================================
-- THE BIG PITCH — Migration: 004_fix_free_points_and_timer.sql
-- Fixes:
--   1. Free points allocation RPC (atomic, idempotent, server-enforced)
--   2. Authoritative pitch timer & investment window durations
--   3. Official competition results & jury ranking independence
--   4. Phase support for presentation ('pitching') vs investment
-- ============================================================

-- 1. Add timer & official judging columns to public.teams
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS pitch_duration_seconds INTEGER DEFAULT 300,
  ADD COLUMN IF NOT EXISTS investment_window_seconds INTEGER DEFAULT 180,
  ADD COLUMN IF NOT EXISTS official_rank INTEGER,
  ADD COLUMN IF NOT EXISTS official_score NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS official_award TEXT,
  ADD COLUMN IF NOT EXISTS official_notes TEXT;

-- 2. Add timer defaults and results publication status to event_config
ALTER TABLE public.event_config
  ADD COLUMN IF NOT EXISTS pitch_duration_seconds INTEGER DEFAULT 300,
  ADD COLUMN IF NOT EXISTS investment_window_seconds INTEGER DEFAULT 180,
  ADD COLUMN IF NOT EXISTS official_results_published BOOLEAN DEFAULT FALSE;

-- 3. Update pitch_rounds status check constraint to include 'pitching'
ALTER TABLE public.pitch_rounds
  DROP CONSTRAINT IF EXISTS pitch_rounds_status_check;

ALTER TABLE public.pitch_rounds
  ADD CONSTRAINT pitch_rounds_status_check
  CHECK (status IN (
    'scheduled',
    'announced',
    'pitching',
    'investment_open',
    'investment_paused',
    'investment_closed',
    'completed'
  ));

-- 4. Improved, atomic, idempotent grant_free_points RPC
DROP FUNCTION IF EXISTS public.grant_free_points(UUID, UUID);

CREATE OR REPLACE FUNCTION public.grant_free_points(
  p_user_id  UUID,
  p_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allocation INTEGER := 500;
  v_wallet     public.wallets%ROWTYPE;
  v_granted    BOOLEAN := FALSE;
BEGIN
  -- Read configured free allocation for event (fallback to 500)
  SELECT COALESCE(free_points_allocation, 500)
  INTO v_allocation
  FROM public.event_config
  WHERE event_id = p_event_id;

  IF v_allocation IS NULL THEN
    v_allocation := 500;
  END IF;

  -- Lock existing wallet row if present
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id AND event_id = p_event_id
  FOR UPDATE;

  IF FOUND THEN
    -- If free grant was already issued, do not issue again (idempotent protection)
    IF v_wallet.free_points_granted THEN
      RETURN FALSE;
    ELSE
      -- Wallet exists but free grant was not yet credited
      UPDATE public.wallets SET
        free_points         = free_points + v_allocation,
        free_points_granted = TRUE,
        updated_at          = NOW()
      WHERE id = v_wallet.id
      RETURNING * INTO v_wallet;

      v_granted := TRUE;
    END IF;
  ELSE
    -- Create brand new wallet with authoritative free allocation
    INSERT INTO public.wallets (
      user_id,
      event_id,
      free_points,
      purchased_points,
      invested_points,
      total_spent_points,
      total_paid_rupees,
      free_points_granted
    ) VALUES (
      p_user_id,
      p_event_id,
      v_allocation,
      0,
      0,
      0,
      0,
      TRUE
    )
    RETURNING * INTO v_wallet;

    v_granted := TRUE;
  END IF;

  -- If points were granted in this transaction, write ledger entry
  IF v_granted THEN
    INSERT INTO public.wallet_ledger (
      wallet_id,
      user_id,
      event_id,
      type,
      amount,
      balance_after,
      description
    ) VALUES (
      v_wallet.id,
      p_user_id,
      p_event_id,
      'free_grant',
      v_allocation,
      v_wallet.free_points + v_wallet.purchased_points,
      format('Welcome bonus — %s free starting points', v_allocation)
    );

    -- Register attendee in event participants
    INSERT INTO public.event_participants (event_id, user_id)
    VALUES (p_event_id, p_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_granted;
END;
$$;

-- Grant execution permissions on RPC
GRANT EXECUTE ON FUNCTION public.grant_free_points(UUID, UUID) TO authenticated, anon;
