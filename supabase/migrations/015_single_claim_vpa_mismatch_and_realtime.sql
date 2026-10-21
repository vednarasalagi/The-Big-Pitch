-- ============================================================
-- The Big Pitch — Single Active Claim, VPA Mismatch Alert,
-- Idempotent 1-Time Allotment, Claim Deletion & Realtime Fix
-- Migration: 015_single_claim_vpa_mismatch_and_realtime.sql
-- ============================================================

-- ============================================================
-- 0. EXTENSIONS SETUP
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. IDEMPOTENT WALLET ALLOTMENT (1-TIME POINT CREDIT ONLY)
-- ============================================================
DROP FUNCTION IF EXISTS public.credit_purchased_points(UUID, UUID, INTEGER, INTEGER, UUID);

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
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_after INTEGER;
BEGIN
  -- 1. Idempotency Guard: Never grant points more than once for the same claim/order
  IF p_payment_order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.wallet_ledger
    WHERE user_id = p_user_id
      AND reference_id = p_payment_order_id
      AND type = 'purchase'
  ) THEN
    -- Already credited once! Return immediately without double-allocating.
    RETURN;
  END IF;

  -- 2. Lock or Upsert wallet
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

  -- 3. Append to wallet_ledger with reference_id
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
-- 2. SINGLE ACTIVE PURCHASE CLAIM PER USER PER TRANSACTION
-- ============================================================
-- Reuses existing pending claim instead of spawning messy duplicates!
DROP FUNCTION IF EXISTS public.create_payment_intent(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_event_id      UUID,
  p_rupee_amount  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_user_id             UUID;
  v_wallet              public.wallets%ROWTYPE;
  v_config              public.event_config%ROWTYPE;
  v_points_to_credit    INTEGER;
  v_claim_code          TEXT;
  v_intent_id           UUID;
  v_expires_at          TIMESTAMPTZ;
  v_collision_tries     INTEGER := 0;
  v_existing_intent     public.payment_intents%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create payment intent';
  END IF;

  IF p_rupee_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  -- 1. Fetch event configuration
  SELECT * INTO v_config FROM public.event_config WHERE event_id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event configuration not found for event %', p_event_id;
  END IF;

  -- 2. Check spending cap
  SELECT * INTO v_wallet FROM public.wallets
  WHERE user_id = v_user_id AND event_id = p_event_id;

  IF v_wallet.id IS NOT NULL THEN
    IF (v_wallet.total_paid_rupees + p_rupee_amount) > v_config.max_paid_purchase_rupees THEN
      RAISE EXCEPTION 'Purchase of ₹% exceeds remaining allowance of ₹%',
        p_rupee_amount, (v_config.max_paid_purchase_rupees - v_wallet.total_paid_rupees);
    END IF;
  ELSE
    IF p_rupee_amount > v_config.max_paid_purchase_rupees THEN
      RAISE EXCEPTION 'Purchase of ₹% exceeds maximum allowed limit of ₹%',
        p_rupee_amount, v_config.max_paid_purchase_rupees;
    END IF;
  END IF;

  v_points_to_credit := p_rupee_amount * v_config.points_per_rupee;
  v_expires_at := NOW() + INTERVAL '30 minutes';

  -- 3. SINGLE ACTIVE CLAIM GUARD:
  -- If user already has an active pending/processing intent, reuse it and update the details!
  SELECT * INTO v_existing_intent
  FROM public.payment_intents
  WHERE user_id = v_user_id
    AND event_id = p_event_id
    AND status IN ('pending', 'processing')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_intent.id IS NOT NULL THEN
    UPDATE public.payment_intents
    SET rupee_amount      = p_rupee_amount,
        points_to_credit  = v_points_to_credit,
        expires_at        = v_expires_at,
        updated_at        = NOW()
    WHERE id = v_existing_intent.id
    RETURNING id, claim_code, rupee_amount, points_to_credit, expires_at
    INTO v_intent_id, v_claim_code, p_rupee_amount, v_points_to_credit, v_expires_at;

    -- Expire any older duplicate pending claims for this user
    UPDATE public.payment_intents
    SET status = 'expired', updated_at = NOW()
    WHERE user_id = v_user_id
      AND event_id = p_event_id
      AND status = 'pending'
      AND id != v_intent_id;

    RETURN jsonb_build_object(
      'success', true,
      'intent_id', v_intent_id,
      'claim_code', v_claim_code,
      'rupee_amount', p_rupee_amount,
      'points_to_credit', v_points_to_credit,
      'expires_at', v_expires_at,
      'reused', true
    );
  END IF;

  -- 4. Otherwise, generate a unique claim code using core Postgres gen_random_uuid
  LOOP
    v_claim_code := 'BP-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 6));
    BEGIN
      INSERT INTO public.payment_intents (
        user_id,
        event_id,
        claim_code,
        rupee_amount,
        points_to_credit,
        status,
        expires_at
      ) VALUES (
        v_user_id,
        p_event_id,
        v_claim_code,
        p_rupee_amount,
        v_points_to_credit,
        'pending',
        v_expires_at
      ) RETURNING id INTO v_intent_id;

      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_collision_tries := v_collision_tries + 1;
      IF v_collision_tries > 5 THEN
        RAISE EXCEPTION 'Could not generate unique claim code. Please retry.';
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'intent_id', v_intent_id,
    'claim_code', v_claim_code,
    'rupee_amount', p_rupee_amount,
    'points_to_credit', v_points_to_credit,
    'expires_at', v_expires_at,
    'reused', false
  );
END;
$$;

-- ============================================================
-- 3. VPA MISMATCH DETECTION & VERIFICATION IN CLAIM RPC
-- ============================================================
DROP FUNCTION IF EXISTS public.claim_payment_intent(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.claim_payment_intent(UUID, TEXT);
DROP FUNCTION IF EXISTS public.claim_payment_intent(UUID);

CREATE OR REPLACE FUNCTION public.claim_payment_intent(
  p_intent_id   UUID,
  p_utr         TEXT DEFAULT NULL,
  p_vpa         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id             UUID;
  v_intent              public.payment_intents%ROWTYPE;
  v_payment             public.qr_payments%ROWTYPE;
  v_unmatched_payment   public.qr_payments%ROWTYPE;
  v_matches_found       INTEGER;
  v_clean_utr           TEXT;
  v_clean_vpa           TEXT;
  v_masked_hint         TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to claim payment';
  END IF;

  -- 1. Lock payment intent FOR UPDATE
  SELECT * INTO v_intent FROM public.payment_intents
  WHERE id = p_intent_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment intent % not found or not owned by user', p_intent_id;
  END IF;

  IF v_intent.status = 'credited' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'credited',
      'already_credited', true,
      'points_credited', v_intent.points_to_credit,
      'payment_id', v_intent.matched_payment_id,
      'message', format('Already credited! %s points are safely in your wallet.', v_intent.points_to_credit)
    );
  END IF;

  IF v_intent.expires_at < NOW() THEN
    -- Auto-extend active checkout claim window
    UPDATE public.payment_intents SET expires_at = NOW() + INTERVAL '15 minutes' WHERE id = v_intent.id;
  END IF;

  v_clean_utr := UPPER(REGEXP_REPLACE(COALESCE(p_utr, ''), '[^a-zA-Z0-9]', '', 'g'));
  v_clean_vpa := LOWER(TRIM(COALESCE(p_vpa, '')));

  -- Update user_vpa & user_utr on the intent
  UPDATE public.payment_intents
  SET user_utr   = CASE WHEN v_clean_utr != '' THEN v_clean_utr ELSE user_utr END,
      user_vpa   = CASE WHEN v_clean_vpa != '' THEN v_clean_vpa ELSE user_vpa END,
      status     = CASE WHEN status = 'pending' THEN 'processing' ELSE status END,
      updated_at = NOW()
  WHERE id = v_intent.id;

  -- Auto-save UPI ID to profile
  IF LENGTH(v_clean_vpa) >= 3 THEN
    UPDATE public.profiles SET upi_id = v_clean_vpa WHERE id = v_user_id;
  END IF;

  -- 2. Search for exact matching unmatched payment in qr_payments
  -- Match Priority:
  -- A. Exact VPA Match OR substring VPA match
  -- B. Exact Bank UTR / RRN match
  SELECT COUNT(*) INTO v_matches_found
  FROM public.qr_payments
  WHERE status = 'unmatched'
    AND rupee_amount = v_intent.rupee_amount
    AND (
      (LENGTH(v_clean_vpa) >= 3 AND (
        LOWER(payer_vpa) = v_clean_vpa
        OR LOWER(payer_vpa) LIKE '%' || v_clean_vpa || '%'
        OR v_clean_vpa LIKE '%' || LOWER(payer_vpa) || '%'
      ))
      OR
      (LENGTH(v_clean_utr) >= 6 AND (
        UPPER(bank_rrn) = v_clean_utr
        OR UPPER(bank_rrn) ILIKE '%' || v_clean_utr || '%'
      ))
    )
    AND payment_time >= (v_intent.created_at - INTERVAL '1 hour')
    AND payment_time <= (NOW() + INTERVAL '15 minutes');

  IF v_matches_found = 1 THEN
    -- Exactly 1 match! Lock payment row FOR UPDATE
    SELECT * INTO v_payment
    FROM public.qr_payments
    WHERE status = 'unmatched'
      AND rupee_amount = v_intent.rupee_amount
      AND (
        (LENGTH(v_clean_vpa) >= 3 AND (
          LOWER(payer_vpa) = v_clean_vpa
          OR LOWER(payer_vpa) LIKE '%' || v_clean_vpa || '%'
          OR v_clean_vpa LIKE '%' || LOWER(payer_vpa) || '%'
        ))
        OR
        (LENGTH(v_clean_utr) >= 6 AND (
          UPPER(bank_rrn) = v_clean_utr
          OR UPPER(bank_rrn) ILIKE '%' || v_clean_utr || '%'
        ))
      )
      AND payment_time >= (v_intent.created_at - INTERVAL '1 hour')
      AND payment_time <= (NOW() + INTERVAL '15 minutes')
    FOR UPDATE;

    -- Mark payment as matched
    UPDATE public.qr_payments SET
      status            = 'matched',
      matched_intent_id = v_intent.id,
      matched_user_id   = v_user_id,
      admin_notes       = COALESCE(admin_notes || ' | ', '') || 'Auto-matched via UPI VPA/UTR verification',
      updated_at        = NOW()
    WHERE id = v_payment.id;

    -- Mark intent as credited
    UPDATE public.payment_intents SET
      status              = 'credited',
      matched_payment_id  = v_payment.razorpay_payment_id,
      matched_at          = NOW(),
      updated_at          = NOW()
    WHERE id = v_intent.id;

    -- 1-Time Allotment Guard
    PERFORM public.credit_purchased_points(
      v_user_id,
      v_intent.event_id,
      v_intent.points_to_credit,
      v_intent.rupee_amount,
      v_intent.id
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'credited',
      'matched', true,
      'points_credited', v_intent.points_to_credit,
      'payment_id', v_payment.razorpay_payment_id,
      'message', format('Payment verified! %s points credited to your wallet via UPI (%s).', v_intent.points_to_credit, COALESCE(v_payment.payer_vpa, 'verified'))
    );

  ELSIF v_matches_found > 1 THEN
    UPDATE public.payment_intents SET
      status = 'manual_review',
      admin_notes = format('Ambiguous: %s payments matched', v_matches_found),
      updated_at = NOW()
    WHERE id = v_intent.id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'manual_review',
      'matched', false,
      'message', 'Multiple bank payments detected. Our admin desk will verify and credit your points promptly.'
    );

  ELSE
    -- 0 Matches: Check if a payment for this exact amount arrived from a DIFFERENT UPI handle!
    SELECT * INTO v_unmatched_payment
    FROM public.qr_payments
    WHERE status = 'unmatched'
      AND rupee_amount = v_intent.rupee_amount
      AND payment_time >= (v_intent.created_at - INTERVAL '20 minutes')
    ORDER BY payment_time DESC
    LIMIT 1;

    IF v_unmatched_payment.id IS NOT NULL AND v_unmatched_payment.payer_vpa IS NOT NULL AND LOWER(v_unmatched_payment.payer_vpa) != v_clean_vpa THEN
      v_masked_hint := SUBSTRING(v_unmatched_payment.payer_vpa FROM 1 FOR 3) || '***@' || SPLIT_PART(v_unmatched_payment.payer_vpa, '@', 2);
      
      UPDATE public.payment_intents
      SET status = 'vpa_mismatch',
          admin_notes = format('Payer UPI mismatch: user registered %s but payment arrived from %s', v_clean_vpa, v_unmatched_payment.payer_vpa),
          updated_at = NOW()
      WHERE id = v_intent.id;

      RETURN jsonb_build_object(
        'success', true,
        'status', 'vpa_mismatch',
        'matched', false,
        'received_vpa_hint', v_masked_hint,
        'message', format('Payment of ₹%s was received, but from a different UPI ID (%s). Please update your UPI ID or submit the 12-digit UTR from your receipt.', v_intent.rupee_amount, v_masked_hint)
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'pending',
      'matched', false,
      'message', 'Awaiting bank confirmation. Please allow up to 1 minute or enter your 12-digit UTR.'
    );
  END IF;
END;
$$;

-- ============================================================
-- 4. RPC: ADMIN DELETE PURCHASE CLAIM / INTENT
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_delete_payment_intent(UUID);

CREATE OR REPLACE FUNCTION public.admin_delete_payment_intent(p_intent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.is_admin(v_admin_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required';
  END IF;

  -- 1. Unlink any qr_payments row referencing this intent
  UPDATE public.qr_payments
  SET matched_intent_id = NULL,
      status = CASE WHEN status = 'matched' THEN 'unmatched' ELSE status END
  WHERE matched_intent_id = p_intent_id;

  -- 2. Delete the payment intent
  DELETE FROM public.payment_intents WHERE id = p_intent_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment intent not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'deleted_intent_id', p_intent_id);
END;
$$;

-- ============================================================
-- 5. RPC: ADMIN REJECT PAYMENT (FIX AUDIT LOGS EVENT_ID ERROR)
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_reject_payment(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_reject_payment(
  p_payment_id  TEXT,
  p_notes       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_admin_id  UUID;
  v_payment   public.qr_payments%ROWTYPE;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin authentication required';
  END IF;

  -- Verify admin privileges
  IF NOT (
    public.is_admin(v_admin_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required';
  END IF;

  SELECT * INTO v_payment FROM public.qr_payments
  WHERE razorpay_payment_id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment % not found', p_payment_id;
  END IF;

  IF v_payment.status = 'matched' THEN
    RAISE EXCEPTION 'Cannot reject an already matched and credited payment. Use manual adjustment instead.';
  END IF;

  UPDATE public.qr_payments SET
    status      = 'rejected',
    admin_notes = p_notes,
    updated_at  = NOW()
  WHERE id = v_payment.id;

  -- Resilient audit log entry matching actual schema
  BEGIN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      entity_id,
      entity_type,
      changes
    ) VALUES (
      v_admin_id,
      'payment_rejected',
      v_payment.id,
      'qr_payments',
      jsonb_build_object(
        'payment_id', p_payment_id,
        'amount', v_payment.rupee_amount,
        'payer_vpa', v_payment.payer_vpa,
        'notes', p_notes
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'status', 'rejected'
  );
END;
$$;

DROP FUNCTION IF EXISTS public.admin_flag_intent(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_flag_intent(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.admin_flag_intent(
  p_intent_id UUID,
  p_status    TEXT,
  p_notes     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_admin_id  UUID;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin authentication required';
  END IF;

  IF NOT (
    public.is_admin(v_admin_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required';
  END IF;

  UPDATE public.payment_intents SET
    status      = p_status,
    admin_notes = COALESCE(p_notes, admin_notes),
    updated_at  = NOW()
  WHERE id = p_intent_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: ADMIN MANUAL MATCH PAYMENT (RESILIENT & BULLETPROOF)
DROP FUNCTION IF EXISTS public.admin_manual_match_payment(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_manual_match_payment(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.admin_manual_match_payment(
  p_payment_id   TEXT,
  p_intent_id    UUID,
  p_admin_notes  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_admin_id  UUID;
  v_payment   public.qr_payments%ROWTYPE;
  v_intent    public.payment_intents%ROWTYPE;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin authentication required';
  END IF;

  IF NOT (
    public.is_admin(v_admin_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required';
  END IF;

  -- 1. Lock payment FOR UPDATE
  SELECT * INTO v_payment FROM public.qr_payments
  WHERE razorpay_payment_id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR Payment % not found', p_payment_id;
  END IF;

  IF v_payment.status = 'matched' THEN
    RAISE EXCEPTION 'Payment % is already matched to intent %', p_payment_id, v_payment.matched_intent_id;
  END IF;

  -- 2. Lock intent FOR UPDATE
  SELECT * INTO v_intent FROM public.payment_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment intent % not found', p_intent_id;
  END IF;

  IF v_intent.status = 'credited' THEN
    RAISE EXCEPTION 'Payment intent % is already credited', p_intent_id;
  END IF;

  -- Verify amount match
  IF v_payment.rupee_amount != v_intent.rupee_amount THEN
    RAISE EXCEPTION 'Amount mismatch: Payment is ₹%, but intent requires ₹%',
      v_payment.rupee_amount, v_intent.rupee_amount;
  END IF;

  -- 3. Update payment
  UPDATE public.qr_payments SET
    status            = 'matched',
    matched_intent_id = v_intent.id,
    matched_user_id   = v_intent.user_id,
    admin_notes       = COALESCE(p_admin_notes, admin_notes),
    updated_at        = NOW()
  WHERE id = v_payment.id;

  -- 4. Update intent
  UPDATE public.payment_intents SET
    status              = 'credited',
    matched_payment_id  = v_payment.razorpay_payment_id,
    matched_at          = NOW(),
    admin_notes         = COALESCE(p_admin_notes, admin_notes),
    updated_at          = NOW()
  WHERE id = v_intent.id;

  -- 5. Credit tokens to user wallet (Idempotent 1-time grant)
  PERFORM public.credit_purchased_points(
    v_intent.user_id,
    v_intent.event_id,
    v_intent.points_to_credit,
    v_intent.rupee_amount,
    v_intent.id
  );

  -- 6. Resilient audit log entry
  BEGIN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      entity_id,
      entity_type,
      changes
    ) VALUES (
      v_admin_id,
      'payment_manual_matched',
      v_intent.id,
      'payment_intents',
      jsonb_build_object(
        'payment_id', p_payment_id,
        'intent_id', p_intent_id,
        'user_id', v_intent.user_id,
        'rupee_amount', v_payment.rupee_amount,
        'points_credited', v_intent.points_to_credit,
        'notes', p_admin_notes
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Successfully matched payment %s and credited %s points to user.', p_payment_id, v_intent.points_to_credit),
    'points_credited', v_intent.points_to_credit
  );
END;
$$;

-- RPC: ADMIN ADJUST USER POINTS (RESILIENT & BULLETPROOF)
DROP FUNCTION IF EXISTS public.admin_adjust_user_points(UUID, UUID, INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.admin_adjust_user_points(UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.admin_adjust_user_points(
  p_user_id       UUID,
  p_event_id      UUID,
  p_points        INTEGER,
  p_rupee_amount  INTEGER DEFAULT 0,
  p_reason        TEXT DEFAULT 'Admin Point Adjustment'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_admin_id      UUID;
  v_wallet_id     UUID;
  v_new_balance   INTEGER;
  v_new_purchased INTEGER;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin authentication required';
  END IF;

  IF NOT (
    public.is_admin(v_admin_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required';
  END IF;

  IF p_points = 0 THEN
    RAISE EXCEPTION 'Points adjustment cannot be zero';
  END IF;

  -- Upsert or Lock wallet FOR UPDATE
  INSERT INTO public.wallets (user_id, event_id, purchased_points, total_paid_rupees)
  VALUES (p_user_id, p_event_id, GREATEST(0, p_points), GREATEST(0, p_rupee_amount))
  ON CONFLICT (user_id, event_id) DO UPDATE SET
    purchased_points  = GREATEST(0, wallets.purchased_points + p_points),
    total_paid_rupees = wallets.total_paid_rupees + GREATEST(0, p_rupee_amount),
    updated_at        = NOW()
  RETURNING id, free_points + purchased_points, purchased_points INTO v_wallet_id, v_new_balance, v_new_purchased;

  IF v_wallet_id IS NULL THEN
    SELECT id, free_points + purchased_points, purchased_points INTO v_wallet_id, v_new_balance, v_new_purchased
    FROM public.wallets WHERE user_id = p_user_id AND event_id = p_event_id;
  END IF;

  -- Append to wallet_ledger
  INSERT INTO public.wallet_ledger (
    wallet_id,
    user_id,
    event_id,
    type,
    amount,
    balance_after,
    description,
    reference_id
  ) VALUES (
    v_wallet_id,
    p_user_id,
    p_event_id,
    'admin_adjustment',
    p_points,
    v_new_balance,
    p_reason,
    v_admin_id
  );

  -- Resilient audit log entry
  BEGIN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      entity_id,
      entity_type,
      changes
    ) VALUES (
      v_admin_id,
      'admin_points_grant',
      p_user_id,
      'wallets',
      jsonb_build_object(
        'target_user_id', p_user_id,
        'points_adjusted', p_points,
        'rupee_amount', p_rupee_amount,
        'reason', p_reason,
        'new_balance', v_new_balance
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'purchased_points', v_new_purchased,
    'message', format('Successfully adjusted points by %s for user.', p_points)
  );
END;
$$;

-- ============================================================
-- 6. REALTIME REPLICATION CONFIGURATION (NO REFRESH NEEDED)
-- ============================================================
ALTER TABLE public.payment_intents REPLICA IDENTITY FULL;
ALTER TABLE public.qr_payments REPLICA IDENTITY FULL;
ALTER TABLE public.webhook_events REPLICA IDENTITY FULL;
ALTER TABLE public.wallets REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_intents;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_payments;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_events;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============================================================
-- 7. SECURITY HARDENING: LOCK DOWN AUDIT LOGS & ADMIN ALLOWLIST
-- ============================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_admin_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_read" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_admin_read" ON public.audit_logs;

CREATE POLICY "audit_admin_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_allowlist_select" ON public.admin_allowlist;
DROP POLICY IF EXISTS "allowlist_select" ON public.admin_allowlist;

CREATE POLICY "admin_allowlist_select" ON public.admin_allowlist
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
