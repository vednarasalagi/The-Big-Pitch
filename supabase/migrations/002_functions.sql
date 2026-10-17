-- ============================================================
-- Pitch Arena — Stored Procedures / RPCs
-- Migration: 002_functions.sql
-- ============================================================

-- ============================================================
-- process_investment
-- Called by the invest Edge Function via service role.
-- Atomically:
--   1. Locks wallet row FOR UPDATE
--   2. Checks balance
--   3. Deducts points (preferring free points first)
--   4. Inserts investment record
--   5. Appends ledger entry
--   6. Updates team totals
--   7. Updates round totals
-- Returns: investment UUID or raises exception
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_investment(
  p_user_id   UUID,
  p_event_id  UUID,
  p_team_id   UUID,
  p_round_id  UUID,
  p_amount    INTEGER,
  p_wallet_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet      public.wallets%ROWTYPE;
  v_available   INTEGER;
  v_investment_id UUID;
  v_new_free    INTEGER;
  v_new_purchased INTEGER;
BEGIN
  -- Lock wallet for this transaction
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE id = p_wallet_id AND user_id = p_user_id AND event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found';
  END IF;

  v_available := v_wallet.free_points + v_wallet.purchased_points;

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  -- Deduct from free points first, then purchased
  IF v_wallet.free_points >= p_amount THEN
    v_new_free      := v_wallet.free_points - p_amount;
    v_new_purchased := v_wallet.purchased_points;
  ELSE
    v_new_free      := 0;
    v_new_purchased := v_wallet.purchased_points - (p_amount - v_wallet.free_points);
  END IF;

  -- Update wallet
  UPDATE public.wallets SET
    free_points       = v_new_free,
    purchased_points  = v_new_purchased,
    invested_points   = invested_points + p_amount,
    total_spent_points= total_spent_points + p_amount,
    updated_at        = NOW()
  WHERE id = p_wallet_id;

  -- Create investment record
  INSERT INTO public.investments (user_id, event_id, team_id, round_id, amount)
  VALUES (p_user_id, p_event_id, p_team_id, p_round_id, p_amount)
  RETURNING id INTO v_investment_id;

  -- Append ledger entry
  INSERT INTO public.wallet_ledger (
    wallet_id, user_id, event_id, type, amount,
    balance_after, description, reference_id
  ) VALUES (
    p_wallet_id, p_user_id, p_event_id,
    'investment', -p_amount,
    v_new_free + v_new_purchased,
    'Investment in team',
    v_investment_id
  );

  -- Update team totals
  UPDATE public.teams SET
    total_investment = total_investment + p_amount,
    unique_backers   = (
      SELECT COUNT(DISTINCT user_id)
      FROM public.investments
      WHERE team_id = p_team_id
    ),
    updated_at = NOW()
  WHERE id = p_team_id;

  -- Update round totals
  UPDATE public.pitch_rounds SET
    total_invested    = total_invested + p_amount,
    unique_investors  = (
      SELECT COUNT(DISTINCT user_id)
      FROM public.investments
      WHERE round_id = p_round_id
    ),
    updated_at = NOW()
  WHERE id = p_round_id;

  RETURN v_investment_id;
END;
$$;

-- ============================================================
-- credit_purchased_points
-- Called by payment-webhook Edge Function after Razorpay success.
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_purchased_points(
  p_user_id           UUID,
  p_event_id          UUID,
  p_points            INTEGER,
  p_rupees            INTEGER,
  p_payment_order_id  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_after INTEGER;
BEGIN
  -- Upsert wallet (create if first time)
  INSERT INTO public.wallets (user_id, event_id, purchased_points, total_paid_rupees)
  VALUES (p_user_id, p_event_id, p_points, p_rupees)
  ON CONFLICT (user_id, event_id) DO UPDATE SET
    purchased_points  = wallets.purchased_points + p_points,
    total_paid_rupees = wallets.total_paid_rupees + p_rupees,
    updated_at        = NOW()
  RETURNING id, free_points + purchased_points INTO v_wallet_id, v_balance_after;

  IF v_wallet_id IS NULL THEN
    SELECT id, free_points + purchased_points INTO v_wallet_id, v_balance_after
    FROM public.wallets WHERE user_id = p_user_id AND event_id = p_event_id;
  END IF;

  -- Ledger entry
  INSERT INTO public.wallet_ledger (
    wallet_id, user_id, event_id, type, amount,
    balance_after, description, reference_id
  ) VALUES (
    v_wallet_id, p_user_id, p_event_id,
    'purchase', p_points,
    v_balance_after,
    format('Purchased %s points for ₹%s', p_points, p_rupees),
    p_payment_order_id
  );
END;
$$;

-- ============================================================
-- grant_free_points
-- Called once per user per event to grant welcome bonus.
-- ============================================================
CREATE OR REPLACE FUNCTION public.grant_free_points(
  p_user_id  UUID,
  p_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config     public.event_config%ROWTYPE;
  v_wallet_id  UUID;
  v_balance    INTEGER;
BEGIN
  SELECT * INTO v_config FROM public.event_config WHERE event_id = p_event_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Insert wallet or check existing
  INSERT INTO public.wallets (user_id, event_id, free_points, free_points_granted)
  VALUES (p_user_id, p_event_id, v_config.free_points_allocation, TRUE)
  ON CONFLICT (user_id, event_id) DO NOTHING;

  -- If already existed and granted, skip
  SELECT id, free_points_granted INTO v_wallet_id FROM public.wallets
  WHERE user_id = p_user_id AND event_id = p_event_id;

  IF (SELECT free_points_granted FROM public.wallets WHERE id = v_wallet_id) THEN
    -- Already granted — this is idempotent
    RETURN FALSE;
  END IF;

  -- Grant points
  UPDATE public.wallets SET
    free_points         = free_points + v_config.free_points_allocation,
    free_points_granted = TRUE,
    updated_at          = NOW()
  WHERE id = v_wallet_id;

  -- Ledger
  SELECT free_points + purchased_points INTO v_balance
  FROM public.wallets WHERE id = v_wallet_id;

  INSERT INTO public.wallet_ledger (
    wallet_id, user_id, event_id, type, amount,
    balance_after, description
  ) VALUES (
    v_wallet_id, p_user_id, p_event_id,
    'free_grant', v_config.free_points_allocation,
    v_balance,
    format('Welcome bonus — %s free points', v_config.free_points_allocation)
  );

  -- Register as event participant
  INSERT INTO public.event_participants (event_id, user_id)
  VALUES (p_event_id, p_user_id)
  ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- get_wallet_for_update (helper for invest function)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_wallet_for_update(
  p_user_id  UUID,
  p_event_id UUID
)
RETURNS public.wallets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
BEGIN
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id AND event_id = p_event_id
  FOR UPDATE;
  RETURN v_wallet;
END;
$$;
