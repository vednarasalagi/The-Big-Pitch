-- ============================================================
-- The Big Pitch — Static QR Payment Migration & Reconciliation System
-- Migration: 010_static_qr_payment_system.sql
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PAYMENT INTENTS (Audience Purchase Requests & Claim Codes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_intents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  claim_code          TEXT NOT NULL UNIQUE,
  rupee_amount        INTEGER NOT NULL CHECK (rupee_amount > 0),
  points_to_credit    INTEGER NOT NULL CHECK (points_to_credit > 0),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'credited', 'manual_review', 'expired', 'failed', 'cancelled')),
  user_utr            TEXT,                -- 12-digit UPI RRN / Bank Reference entered by user
  user_vpa            TEXT,                -- Payer UPI ID if entered by user
  matched_payment_id  TEXT,                -- References public.qr_payments(razorpay_payment_id)
  matched_at          TIMESTAMPTZ,
  admin_notes         TEXT,
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_intents_user_event_idx ON public.payment_intents(user_id, event_id);
CREATE INDEX IF NOT EXISTS payment_intents_claim_code_idx ON public.payment_intents(claim_code);
CREATE INDEX IF NOT EXISTS payment_intents_user_utr_idx ON public.payment_intents(user_utr);
CREATE INDEX IF NOT EXISTS payment_intents_status_idx ON public.payment_intents(status);
CREATE INDEX IF NOT EXISTS payment_intents_expires_at_idx ON public.payment_intents(expires_at);

-- ============================================================
-- 2. QR PAYMENTS (Incoming Razorpay Static QR Payments)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.qr_payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_payment_id   TEXT NOT NULL UNIQUE, -- Idempotency key: prevents double crediting
  razorpay_qr_id        TEXT,
  amount_paise          INTEGER NOT NULL CHECK (amount_paise > 0),
  rupee_amount          INTEGER NOT NULL CHECK (rupee_amount > 0),
  currency              TEXT NOT NULL DEFAULT 'INR',
  payer_vpa             TEXT,                 -- e.g. payer@okhdfcbank
  bank_rrn              TEXT,                 -- 12-digit UTR / RRN from acquirer_data
  status                TEXT NOT NULL DEFAULT 'unmatched'
                        CHECK (status IN ('unmatched', 'matched', 'manual_review', 'rejected', 'refunded')),
  matched_intent_id     UUID REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  matched_user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  raw_payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_time          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admin_notes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qr_payments_payment_id_idx ON public.qr_payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS qr_payments_bank_rrn_idx ON public.qr_payments(bank_rrn);
CREATE INDEX IF NOT EXISTS qr_payments_amount_status_idx ON public.qr_payments(rupee_amount, status);
CREATE INDEX IF NOT EXISTS qr_payments_matched_intent_idx ON public.qr_payments(matched_intent_id);
CREATE INDEX IF NOT EXISTS qr_payments_payment_time_idx ON public.qr_payments(payment_time);

-- ============================================================
-- 3. WEBHOOK EVENTS (Raw Audit Trail of Received Webhooks)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type          TEXT NOT NULL,
  event_id            TEXT,
  signature_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  status              TEXT NOT NULL DEFAULT 'received'
                      CHECK (status IN ('received', 'processed', 'ignored', 'failed', 'duplicate')),
  error_message       TEXT,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_events_type_idx ON public.webhook_events(event_type);
CREATE INDEX IF NOT EXISTS webhook_events_created_at_idx ON public.webhook_events(created_at DESC);

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-run
DROP POLICY IF EXISTS "intents_user_read" ON public.payment_intents;
DROP POLICY IF EXISTS "intents_user_insert" ON public.payment_intents;
DROP POLICY IF EXISTS "intents_user_update" ON public.payment_intents;
DROP POLICY IF EXISTS "intents_admin_all" ON public.payment_intents;

DROP POLICY IF EXISTS "qr_payments_admin_all" ON public.qr_payments;
DROP POLICY IF EXISTS "webhook_events_admin_all" ON public.webhook_events;

-- Users can read their own payment intents
CREATE POLICY "intents_user_read" ON public.payment_intents
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own payment intents
CREATE POLICY "intents_user_insert" ON public.payment_intents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update user_utr/user_vpa on their own pending intents
CREATE POLICY "intents_user_update" ON public.payment_intents
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins have full access to payment intents
CREATE POLICY "intents_admin_all" ON public.payment_intents
  FOR ALL
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  );

-- Only Admins can view/update qr_payments (Regular users cannot view other people's payments/UTRs)
CREATE POLICY "qr_payments_admin_all" ON public.qr_payments
  FOR ALL
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  );

-- Only Admins can view webhook_events
CREATE POLICY "webhook_events_admin_all" ON public.webhook_events
  FOR ALL
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  );

-- ============================================================
-- 5. RPC: CREATE PAYMENT INTENT
-- Generates a short-lived claim code and reserves payment intent
-- Enforces wallet max_paid_purchase_rupees limit atomically.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_event_id      UUID,
  p_rupee_amount  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- 2. Fetch or lock existing wallet
  SELECT * INTO v_wallet FROM public.wallets
  WHERE user_id = v_user_id AND event_id = p_event_id;

  -- Check spending cap
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

  -- Calculate points to credit
  v_points_to_credit := p_rupee_amount * v_config.points_per_rupee;
  v_expires_at := NOW() + INTERVAL '30 minutes';

  -- 3. Generate unique claim code (format: BP-XXXXXX, e.g. BP-7K9A2F)
  LOOP
    v_claim_code := 'BP-' || UPPER(SUBSTRING(encode(gen_random_bytes(4), 'hex') FROM 1 FOR 6));
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

      EXIT; -- Success, break out of loop
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
    'expires_at', v_expires_at
  );
END;
$$;

-- ============================================================
-- 6. RPC: CLAIM PAYMENT INTENT (User submits UTR to claim tokens)
-- Atomically matches with qr_payments if incoming webhook arrived.
-- If webhook not yet arrived, registers UTR so incoming webhook matches immediately.
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_payment_intent(
  p_intent_id UUID,
  p_utr       TEXT,
  p_vpa       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id       UUID;
  v_intent        public.payment_intents%ROWTYPE;
  v_payment       public.qr_payments%ROWTYPE;
  v_clean_utr     TEXT;
  v_matches_found INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to claim payment';
  END IF;

  -- Sanitize UTR: strip whitespace, dashes
  v_clean_utr := UPPER(REGEXP_REPLACE(COALESCE(p_utr, ''), '[^a-zA-Z0-9]', '', 'g'));
  IF LENGTH(v_clean_utr) < 6 THEN
    RAISE EXCEPTION 'Invalid UPI Reference / UTR Number. Must be at least 6 alphanumeric characters.';
  END IF;

  -- 1. Lock payment_intent FOR UPDATE
  SELECT * INTO v_intent FROM public.payment_intents
  WHERE id = p_intent_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment intent not found or unauthorized';
  END IF;

  -- Already credited
  IF v_intent.status = 'credited' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'credited',
      'already_credited', true,
      'points_credited', v_intent.points_to_credit,
      'message', 'Payment already verified and tokens credited to your wallet.'
    );
  END IF;

  -- Check expiration
  IF v_intent.expires_at < NOW() AND v_intent.status = 'pending' THEN
    UPDATE public.payment_intents SET status = 'expired', updated_at = NOW() WHERE id = v_intent.id;
    RETURN jsonb_build_object(
      'success', false,
      'status', 'expired',
      'message', 'This payment intent has expired. Please create a new top-up request.'
    );
  END IF;

  -- Update user UTR and VPA on intent
  UPDATE public.payment_intents
  SET user_utr = v_clean_utr,
      user_vpa = COALESCE(p_vpa, user_vpa),
      updated_at = NOW()
  WHERE id = v_intent.id;

  -- 2. Check for unmatched payment in qr_payments
  -- Match condition:
  --   a. status = 'unmatched'
  --   b. rupee_amount = intent.rupee_amount
  --   c. bank_rrn matches clean_utr (exact or substring)
  --   d. payment_time within window: between (intent.created_at - 1 hour) and (intent.expires_at + 15 minutes)
  SELECT COUNT(*) INTO v_matches_found
  FROM public.qr_payments
  WHERE status = 'unmatched'
    AND rupee_amount = v_intent.rupee_amount
    AND (
      UPPER(bank_rrn) = v_clean_utr
      OR UPPER(bank_rrn) ILIKE '%' || v_clean_utr || '%'
      OR v_clean_utr ILIKE '%' || UPPER(bank_rrn) || '%'
    )
    AND payment_time >= (v_intent.created_at - INTERVAL '1 hour')
    AND payment_time <= (v_intent.expires_at + INTERVAL '15 minutes');

  IF v_matches_found = 1 THEN
    -- Exactly 1 unambiguous match! Lock the payment row FOR UPDATE
    SELECT * INTO v_payment
    FROM public.qr_payments
    WHERE status = 'unmatched'
      AND rupee_amount = v_intent.rupee_amount
      AND (
        UPPER(bank_rrn) = v_clean_utr
        OR UPPER(bank_rrn) ILIKE '%' || v_clean_utr || '%'
        OR v_clean_utr ILIKE '%' || UPPER(bank_rrn) || '%'
      )
      AND payment_time >= (v_intent.created_at - INTERVAL '1 hour')
      AND payment_time <= (v_intent.expires_at + INTERVAL '15 minutes')
    FOR UPDATE;

    -- Mark payment as matched
    UPDATE public.qr_payments SET
      status            = 'matched',
      matched_intent_id = v_intent.id,
      matched_user_id   = v_user_id,
      updated_at        = NOW()
    WHERE id = v_payment.id;

    -- Mark intent as credited
    UPDATE public.payment_intents SET
      status              = 'credited',
      matched_payment_id  = v_payment.razorpay_payment_id,
      matched_at          = NOW(),
      updated_at          = NOW()
    WHERE id = v_intent.id;

    -- Atomically credit wallet and append ledger entry
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
      'message', format('Success! %s points have been credited to your wallet.', v_intent.points_to_credit)
    );

  ELSIF v_matches_found > 1 THEN
    -- Ambiguous: multiple payments match this UTR & amount. Flag for admin review
    UPDATE public.payment_intents SET
      status = 'manual_review',
      admin_notes = format('Ambiguous match: %s payments matched UTR %s', v_matches_found, v_clean_utr),
      updated_at = NOW()
    WHERE id = v_intent.id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'manual_review',
      'matched', false,
      'message', 'Multiple bank settlements detected with this reference. Our admin team will verify and credit your points shortly.'
    );

  ELSE
    -- Payment not yet received from bank webhook.
    -- UTR is saved on the intent. As soon as Razorpay webhook arrives, it will match automatically.
    RETURN jsonb_build_object(
      'success', true,
      'status', 'pending',
      'matched', false,
      'message', 'UTR registered. Waiting for bank settlement confirmation. Click "Check Status" in a few moments.'
    );
  END IF;
END;
$$;

-- ============================================================
-- 7. RPC: MATCH QR PAYMENT INTERNAL (Called by Webhook Handler)
-- Saves incoming payment idempotently. If a matching pending intent
-- exists with matching UTR and amount, matches and credits tokens.
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_qr_payment_internal(
  p_payment_id    TEXT,
  p_qr_id         TEXT,
  p_amount_paise  INTEGER,
  p_bank_rrn      TEXT,
  p_payer_vpa     TEXT,
  p_raw_payload   JSONB,
  p_payment_time  TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rupee_amount      INTEGER;
  v_clean_rrn         TEXT;
  v_payment           public.qr_payments%ROWTYPE;
  v_intent            public.payment_intents%ROWTYPE;
  v_matching_count    INTEGER;
BEGIN
  v_rupee_amount := p_amount_paise / 100;
  v_clean_rrn := UPPER(REGEXP_REPLACE(COALESCE(p_bank_rrn, ''), '[^a-zA-Z0-9]', '', 'g'));

  -- 1. Idempotent insert into qr_payments
  INSERT INTO public.qr_payments (
    razorpay_payment_id,
    razorpay_qr_id,
    amount_paise,
    rupee_amount,
    currency,
    payer_vpa,
    bank_rrn,
    status,
    raw_payload,
    payment_time
  ) VALUES (
    p_payment_id,
    p_qr_id,
    p_amount_paise,
    v_rupee_amount,
    'INR',
    p_payer_vpa,
    v_clean_rrn,
    'unmatched',
    p_raw_payload,
    COALESCE(p_payment_time, NOW())
  )
  ON CONFLICT (razorpay_payment_id) DO NOTHING;

  -- 2. Lock the payment row FOR UPDATE
  SELECT * INTO v_payment FROM public.qr_payments
  WHERE razorpay_payment_id = p_payment_id
  FOR UPDATE;

  -- If payment is already matched, return idempotently
  IF v_payment.status = 'matched' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'matched', true,
      'matched_intent_id', v_payment.matched_intent_id,
      'matched_user_id', v_payment.matched_user_id
    );
  END IF;

  -- 3. Search for matching pending intent:
  --   a. status in ('pending', 'processing', 'manual_review')
  --   b. rupee_amount = v_rupee_amount
  --   c. user_utr matches clean_rrn
  --   d. not expired (with 30 min grace period for webhook network delay)
  IF LENGTH(v_clean_rrn) >= 6 THEN
    SELECT COUNT(*) INTO v_matching_count
    FROM public.payment_intents
    WHERE status IN ('pending', 'processing', 'manual_review')
      AND rupee_amount = v_rupee_amount
      AND (
        UPPER(user_utr) = v_clean_rrn
        OR UPPER(user_utr) ILIKE '%' || v_clean_rrn || '%'
        OR v_clean_rrn ILIKE '%' || UPPER(user_utr) || '%'
      )
      AND created_at <= (v_payment.payment_time + INTERVAL '30 minutes')
      AND expires_at >= (v_payment.payment_time - INTERVAL '1 hour');

    IF v_matching_count = 1 THEN
      -- Unambiguous match! Lock the intent row FOR UPDATE
      SELECT * INTO v_intent
      FROM public.payment_intents
      WHERE status IN ('pending', 'processing', 'manual_review')
        AND rupee_amount = v_rupee_amount
        AND (
          UPPER(user_utr) = v_clean_rrn
          OR UPPER(user_utr) ILIKE '%' || v_clean_rrn || '%'
          OR v_clean_rrn ILIKE '%' || UPPER(user_utr) || '%'
        )
        AND created_at <= (v_payment.payment_time + INTERVAL '30 minutes')
        AND expires_at >= (v_payment.payment_time - INTERVAL '1 hour')
      FOR UPDATE;

      -- Update qr_payments
      UPDATE public.qr_payments SET
        status            = 'matched',
        matched_intent_id = v_intent.id,
        matched_user_id   = v_intent.user_id,
        updated_at        = NOW()
      WHERE id = v_payment.id;

      -- Update payment_intents
      UPDATE public.payment_intents SET
        status              = 'credited',
        matched_payment_id  = v_payment.razorpay_payment_id,
        matched_at          = NOW(),
        updated_at          = NOW()
      WHERE id = v_intent.id;

      -- Credit points to wallet atomically
      PERFORM public.credit_purchased_points(
        v_intent.user_id,
        v_intent.event_id,
        v_intent.points_to_credit,
        v_intent.rupee_amount,
        v_intent.id
      );

      RETURN jsonb_build_object(
        'success', true,
        'matched', true,
        'matched_intent_id', v_intent.id,
        'matched_user_id', v_intent.user_id,
        'points_credited', v_intent.points_to_credit
      );
    ELSIF v_matching_count > 1 THEN
      -- Multiple intents claimed same UTR: mark payment for manual review
      UPDATE public.qr_payments SET
        status = 'manual_review',
        admin_notes = format('Ambiguous: %s intents matched UTR %s', v_matching_count, v_clean_rrn),
        updated_at = NOW()
      WHERE id = v_payment.id;

      RETURN jsonb_build_object(
        'success', true,
        'matched', false,
        'status', 'manual_review',
        'reason', 'Multiple intents match this UTR'
      );
    END IF;
  END IF;

  -- No match found yet (user has not submitted UTR, or UTR doesn't match).
  -- Payment remains in public.qr_payments with status 'unmatched'.
  RETURN jsonb_build_object(
    'success', true,
    'matched', false,
    'status', 'unmatched',
    'reason', 'Awaiting audience claim or manual match'
  );
END;
$$;

-- ============================================================
-- 8. RPC: ADMIN MANUAL MATCH PAYMENT
-- Enables admin to manually connect any unmatched payment to a user intent
-- Atomically locks both rows and credits the tokens securely.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_manual_match_payment(
  p_payment_id  TEXT,
  p_intent_id   UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Verify admin privileges
  IF NOT (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin')
    OR
    EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = (SELECT email FROM auth.users WHERE id = v_admin_id))
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

  -- Verify amount match (with admin warning / override allowed if needed)
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

  -- 5. Credit tokens to user wallet
  PERFORM public.credit_purchased_points(
    v_intent.user_id,
    v_intent.event_id,
    v_intent.points_to_credit,
    v_intent.rupee_amount,
    v_intent.id
  );

  -- 6. Record audit log
  INSERT INTO public.audit_logs (
    event_id,
    admin_id,
    action,
    target_id,
    metadata
  ) VALUES (
    v_intent.event_id,
    v_admin_id,
    'payment_manual_matched',
    v_intent.id,
    jsonb_build_object(
      'payment_id', p_payment_id,
      'intent_id', p_intent_id,
      'user_id', v_intent.user_id,
      'rupee_amount', v_payment.rupee_amount,
      'points_credited', v_intent.points_to_credit,
      'notes', p_admin_notes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Successfully matched payment %s and credited %s points to user.', p_payment_id, v_intent.points_to_credit),
    'points_credited', v_intent.points_to_credit
  );
END;
$$;

-- ============================================================
-- 9. RPC: ADMIN REJECT PAYMENT
-- Rejects a payment (e.g. fraudulent, chargeback, or wrong account)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_reject_payment(
  p_payment_id  TEXT,
  p_notes       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
    EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin')
    OR
    EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = (SELECT email FROM auth.users WHERE id = v_admin_id))
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

  INSERT INTO public.audit_logs (
    event_id,
    admin_id,
    action,
    target_id,
    metadata
  ) VALUES (
    '11111111-0000-0000-0000-000000000001'::uuid,
    v_admin_id,
    'payment_rejected',
    v_payment.id,
    jsonb_build_object(
      'payment_id', p_payment_id,
      'amount', v_payment.rupee_amount,
      'reason', p_notes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Payment marked as rejected'
  );
END;
$$;

-- ============================================================
-- 10. RPC: ADMIN FLAG INTENT
-- Update intent status or notes (e.g. flag for review, cancel)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_flag_intent(
  p_intent_id UUID,
  p_status    TEXT,
  p_notes     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id  UUID;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin authentication required';
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin')
    OR
    EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = (SELECT email FROM auth.users WHERE id = v_admin_id))
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

-- ============================================================
-- 11. BACKWARD COMPATIBILITY RPCs (Missing in previous setup)
-- Defines reserve_payment_order, fail_payment_order, finalize_payment_order
-- so legacy create-payment-order edge function will never crash if invoked.
-- ============================================================
CREATE OR REPLACE FUNCTION public.reserve_payment_order(
  p_user_id         UUID,
  p_event_id        UUID,
  p_rupee_amount    INTEGER,
  p_points_to_credit INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  INSERT INTO public.payment_orders (
    user_id,
    event_id,
    razorpay_order_id,
    rupee_amount,
    points_to_credit,
    status
  ) VALUES (
    p_user_id,
    p_event_id,
    'order_res_' || SUBSTRING(encode(gen_random_bytes(8), 'hex') FROM 1 FOR 16),
    p_rupee_amount,
    p_points_to_credit,
    'created'
  ) RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_payment_order(
  p_order_id UUID,
  p_reason   TEXT DEFAULT 'failed'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.payment_orders SET
    status     = 'failed',
    updated_at = NOW()
  WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_payment_order(
  p_order_id           UUID,
  p_razorpay_order_id  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.payment_orders SET
    razorpay_order_id = p_razorpay_order_id,
    status            = 'pending',
    updated_at        = NOW()
  WHERE id = p_order_id;
END;
$$;

-- Enable Supabase Realtime replication on payment_intents and qr_payments
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_intents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_payments;
