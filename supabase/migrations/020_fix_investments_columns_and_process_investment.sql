-- ============================================================
-- The Big Pitch — Fix Investments Columns & Process Investment RPC
-- Migration: 020_fix_investments_columns_and_process_investment.sql
-- ============================================================

-- 1. Ensure required columns exist on public.investments table
ALTER TABLE public.investments 
  ADD COLUMN IF NOT EXISTS free_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_elapsed_ms INTEGER DEFAULT 0;

-- 2. Drop previous function signature to prevent return type mismatch
DROP FUNCTION IF EXISTS public.process_investment(UUID, UUID, UUID, UUID, INTEGER, UUID);
DROP FUNCTION IF EXISTS public.process_investment(UUID, UUID, UUID, UUID, INT, UUID);
DROP FUNCTION IF EXISTS public.process_investment;

-- 3. Stored procedure: Process investment with wallet deduction, reaction time, and gate verification
CREATE OR REPLACE FUNCTION public.process_investment(
  p_user_id    UUID,
  p_event_id   UUID,
  p_team_id    UUID,
  p_round_id   UUID,
  p_amount     INT,
  p_wallet_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_wallet            RECORD;
  v_round             RECORD;
  v_team              RECORD;
  v_config            RECORD;
  v_free_deduct       INT := 0;
  v_paid_deduct       INT := 0;
  v_remaining         INT;
  v_new_free          INT;
  v_new_paid          INT;
  v_new_invested      INT;
  v_investment_id     UUID;
  v_existing_invested INT := 0;
  v_time_elapsed_ms   INT := 0;
  v_open_time_ms      BIGINT;
  v_now_ms            BIGINT;
  v_profile           RECORD;
BEGIN
  -- 1. Gate verification check: User must be verified at the entrance gate OR an admin
  SELECT role, entry_verified INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'User profile not found.');
  END IF;

  IF v_profile.role != 'admin' AND NOT COALESCE(v_profile.entry_verified, FALSE) THEN
    RETURN jsonb_build_object(
      'success', FALSE, 
      'error', 'Account verification required. Please show your Entry Pass QR to an event volunteer at the entrance gate before you can invest.'
    );
  END IF;

  -- 2. Validate round is open for investments
  SELECT * INTO v_round FROM public.pitch_rounds WHERE id = p_round_id;
  IF NOT FOUND OR v_round.status != 'investment_open' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Investment window is not open.');
  END IF;

  IF v_round.investment_close_time IS NOT NULL AND v_round.investment_close_time < NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Investment window deadline has passed.');
  END IF;

  -- 3. Calculate reaction time in milliseconds from window open time
  IF v_round.investment_open_time IS NOT NULL THEN
    v_open_time_ms := (EXTRACT(EPOCH FROM v_round.investment_open_time) * 1000)::BIGINT;
    v_now_ms := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
    v_time_elapsed_ms := GREATEST(1, (v_now_ms - v_open_time_ms)::INT);
  END IF;

  -- 4. Validate event config limits
  SELECT * INTO v_config FROM public.event_config WHERE event_id = p_event_id;
  IF FOUND THEN
    IF p_amount < v_config.min_investment_amount THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Minimum investment is ' || v_config.min_investment_amount || ' points.');
    END IF;
    IF p_amount > v_config.max_investment_amount THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Maximum investment per pitch is ' || v_config.max_investment_amount || ' points.');
    END IF;
  END IF;

  -- 5. Lock and validate user wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE id = p_wallet_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Wallet not found.');
  END IF;

  IF (v_wallet.free_points + v_wallet.purchased_points) < p_amount THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Insufficient points in wallet.');
  END IF;

  -- 6. Deduct from free points first, then purchased points
  v_remaining := p_amount;
  IF v_wallet.free_points >= v_remaining THEN
    v_free_deduct := v_remaining;
    v_remaining   := 0;
  ELSE
    v_free_deduct := v_wallet.free_points;
    v_remaining   := v_remaining - v_wallet.free_points;
  END IF;

  IF v_remaining > 0 THEN
    v_paid_deduct := v_remaining;
  END IF;

  v_new_free     := v_wallet.free_points - v_free_deduct;
  v_new_paid     := v_wallet.purchased_points - v_paid_deduct;
  v_new_invested := v_wallet.invested_points + p_amount;

  -- 7. Update wallet balance
  UPDATE public.wallets
  SET free_points      = v_new_free,
      purchased_points = v_new_paid,
      invested_points  = v_new_invested,
      updated_at       = NOW()
  WHERE id = p_wallet_id;

  -- 8. Insert investment record with free_amount, paid_amount, and time_elapsed_ms
  INSERT INTO public.investments (
    user_id, event_id, team_id, round_id, amount, free_amount, paid_amount, time_elapsed_ms, created_at
  ) VALUES (
    p_user_id, p_event_id, p_team_id, p_round_id, p_amount, v_free_deduct, v_paid_deduct, v_time_elapsed_ms, NOW()
  ) RETURNING id INTO v_investment_id;

  -- 9. Insert wallet ledger entry
  SELECT name INTO v_team FROM public.teams WHERE id = p_team_id;
  INSERT INTO public.wallet_ledger (
    wallet_id, user_id, event_id, type, amount, balance_after, description, reference_id, created_at
  ) VALUES (
    p_wallet_id, p_user_id, p_event_id, 'investment', -p_amount, (v_new_free + v_new_paid),
    'Backed ' || COALESCE(v_team.name, 'Startup') || ' with ' || p_amount || ' points',
    v_investment_id, NOW()
  );

  -- 10. Update startup total investment and unique backer count
  SELECT COALESCE(SUM(amount), 0) INTO v_existing_invested FROM public.investments WHERE team_id = p_team_id;
  UPDATE public.teams
  SET total_investment = v_existing_invested,
      unique_backers   = (SELECT COUNT(DISTINCT user_id) FROM public.investments WHERE team_id = p_team_id),
      updated_at       = NOW()
  WHERE id = p_team_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'investmentId', v_investment_id,
    'timeElapsedMs', v_time_elapsed_ms,
    'newBalance', (v_new_free + v_new_paid)
  );
END;
$$;

-- 4. Grant execution permissions
GRANT EXECUTE ON FUNCTION public.process_investment(UUID, UUID, UUID, UUID, INT, UUID) TO authenticated, anon;

-- 5. Storage bucket: Allow audio files (MP3, WAV, OGG, M4A) for celebration music
UPDATE storage.buckets
SET allowed_mime_types = NULL,
    file_size_limit = 26214400 -- 25 MB
WHERE id = 'avatars';
