-- ============================================================
-- The Big Pitch — VPA Matching, Package QR Codes & Admin Point Grants
-- Migration: 011_vpa_matching_and_admin_grants.sql
-- ============================================================

-- 1. Add upi_id to public.profiles for automatic VPA matching
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS upi_id TEXT;
CREATE INDEX IF NOT EXISTS profiles_upi_id_idx ON public.profiles(LOWER(upi_id));

-- 2. Create package_qr_codes table for the 5 fixed packages
CREATE TABLE IF NOT EXISTS public.package_qr_codes (
  id                  TEXT PRIMARY KEY,
  event_id            UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label               TEXT NOT NULL,
  rupee_amount        INTEGER NOT NULL CHECK (rupee_amount > 0),
  points              INTEGER NOT NULL CHECK (points > 0),
  qr_image_url        TEXT,                -- URL to specific static QR image for this tier
  upi_vpa             TEXT,                -- Merchant UPI VPA if package-specific
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  display_order       INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS package_qr_codes_event_idx ON public.package_qr_codes(event_id, display_order);

-- Seed default 5 packages for the main event
INSERT INTO public.package_qr_codes (id, event_id, label, rupee_amount, points, is_active, display_order)
VALUES
  ('pkg_1', '11111111-0000-0000-0000-000000000001', 'Starter Pack', 10, 100, TRUE, 1),
  ('pkg_2', '11111111-0000-0000-0000-000000000001', 'Supporter Pack', 20, 200, TRUE, 2),
  ('pkg_3', '11111111-0000-0000-0000-000000000001', 'Enthusiast Pack', 50, 500, TRUE, 3),
  ('pkg_4', '11111111-0000-0000-0000-000000000001', 'Champion Pack', 100, 1000, TRUE, 4),
  ('pkg_5', '11111111-0000-0000-0000-000000000001', 'Super Backer', 200, 2000, TRUE, 5)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  rupee_amount = EXCLUDED.rupee_amount,
  points = EXCLUDED.points;

-- RLS for package_qr_codes
ALTER TABLE public.package_qr_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "package_qr_read" ON public.package_qr_codes;
CREATE POLICY "package_qr_read" ON public.package_qr_codes
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "package_qr_admin_write" ON public.package_qr_codes;
CREATE POLICY "package_qr_admin_write" ON public.package_qr_codes
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

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.package_qr_codes;

-- ============================================================
-- 3. RPC: UPDATE USER VPA
-- Saves audience member's UPI ID (e.g. payer@okhdfcbank)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_user_vpa(
  p_vpa TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id   UUID;
  v_clean_vpa TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_clean_vpa := LOWER(TRIM(COALESCE(p_vpa, '')));

  UPDATE public.profiles
  SET upi_id = v_clean_vpa,
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'upi_id', v_clean_vpa);
END;
$$;

-- ============================================================
-- 4. RPC: CLAIM PAYMENT INTENT (VPA Auto-Matching without UTR!)
-- Matches by payer VPA and exact rupee amount
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_payment_intent(
  p_intent_id UUID,
  p_utr       TEXT DEFAULT NULL,
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
  v_clean_vpa     TEXT;
  v_matches_found INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to claim payment';
  END IF;

  v_clean_utr := UPPER(REGEXP_REPLACE(COALESCE(p_utr, ''), '[^a-zA-Z0-9]', '', 'g'));
  v_clean_vpa := LOWER(TRIM(COALESCE(p_vpa, '')));

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

  -- Save VPA and optional UTR to intent and profile
  IF LENGTH(v_clean_vpa) > 0 THEN
    UPDATE public.profiles SET upi_id = v_clean_vpa, updated_at = NOW() WHERE id = v_user_id;
  END IF;

  UPDATE public.payment_intents
  SET user_vpa = COALESCE(NULLIF(v_clean_vpa, ''), user_vpa),
      user_utr = COALESCE(NULLIF(v_clean_utr, ''), user_utr),
      updated_at = NOW()
  WHERE id = v_intent.id;

  -- Refresh v_clean_vpa from intent if not provided in call
  IF LENGTH(v_clean_vpa) = 0 THEN
    v_clean_vpa := LOWER(TRIM(COALESCE(v_intent.user_vpa, '')));
  END IF;

  -- 2. Search for matching unmatched payment in qr_payments
  -- Match Priority:
  -- A. Match on Payer VPA + exact rupee amount within valid time window
  -- B. Match on UTR (if provided) + exact rupee amount
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
    AND payment_time <= (v_intent.expires_at + INTERVAL '15 minutes');

  IF v_matches_found = 1 THEN
    -- Exactly 1 unambiguous match! Lock the payment row FOR UPDATE
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
      'message', format('Success! %s points credited to your wallet via UPI (%s).', v_intent.points_to_credit, COALESCE(v_payment.payer_vpa, 'verified'))
    );

  ELSIF v_matches_found > 1 THEN
    UPDATE public.payment_intents SET
      status = 'manual_review',
      admin_notes = format('Ambiguous: %s payments matched VPA %s', v_matches_found, v_clean_vpa),
      updated_at = NOW()
    WHERE id = v_intent.id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'manual_review',
      'matched', false,
      'message', 'Multiple bank payments detected. Our admin desk will verify and credit your points promptly.'
    );

  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'status', 'pending',
      'matched', false,
      'message', 'Awaiting bank confirmation. Click "Check Status" in a moment.'
    );
  END IF;
END;
$$;

-- ============================================================
-- 5. RPC: MATCH QR PAYMENT INTERNAL (Webhook handler matching)
-- Matches on VPA or UTR automatically
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
  v_clean_vpa         TEXT;
  v_payment           public.qr_payments%ROWTYPE;
  v_intent            public.payment_intents%ROWTYPE;
  v_matching_count    INTEGER;
BEGIN
  v_rupee_amount := p_amount_paise / 100;
  v_clean_rrn := UPPER(REGEXP_REPLACE(COALESCE(p_bank_rrn, ''), '[^a-zA-Z0-9]', '', 'g'));
  v_clean_vpa := LOWER(TRIM(COALESCE(p_payer_vpa, '')));

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

  -- 2. Lock payment row FOR UPDATE
  SELECT * INTO v_payment FROM public.qr_payments
  WHERE razorpay_payment_id = p_payment_id
  FOR UPDATE;

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
  --   Matches if rupee_amount matches AND (VPA matches OR UTR matches)
  SELECT COUNT(*) INTO v_matching_count
  FROM public.payment_intents
  WHERE status IN ('pending', 'processing', 'manual_review')
    AND rupee_amount = v_rupee_amount
    AND (
      (LENGTH(v_clean_vpa) >= 3 AND (
        LOWER(user_vpa) = v_clean_vpa
        OR LOWER(user_vpa) LIKE '%' || v_clean_vpa || '%'
        OR v_clean_vpa LIKE '%' || LOWER(user_vpa) || '%'
        OR user_id IN (SELECT id FROM public.profiles WHERE LOWER(upi_id) = v_clean_vpa)
      ))
      OR
      (LENGTH(v_clean_rrn) >= 6 AND (
        UPPER(user_utr) = v_clean_rrn
        OR UPPER(user_utr) ILIKE '%' || v_clean_rrn || '%'
      ))
    )
    AND created_at <= (v_payment.payment_time + INTERVAL '30 minutes')
    AND expires_at >= (v_payment.payment_time - INTERVAL '1 hour');

  IF v_matching_count = 1 THEN
    -- Exactly 1 unambiguous match!
    SELECT * INTO v_intent
    FROM public.payment_intents
    WHERE status IN ('pending', 'processing', 'manual_review')
      AND rupee_amount = v_rupee_amount
      AND (
        (LENGTH(v_clean_vpa) >= 3 AND (
          LOWER(user_vpa) = v_clean_vpa
          OR LOWER(user_vpa) LIKE '%' || v_clean_vpa || '%'
          OR v_clean_vpa LIKE '%' || LOWER(user_vpa) || '%'
          OR user_id IN (SELECT id FROM public.profiles WHERE LOWER(upi_id) = v_clean_vpa)
        ))
        OR
        (LENGTH(v_clean_rrn) >= 6 AND (
          UPPER(user_utr) = v_clean_rrn
          OR UPPER(user_utr) ILIKE '%' || v_clean_rrn || '%'
        ))
      )
      AND created_at <= (v_payment.payment_time + INTERVAL '30 minutes')
      AND expires_at >= (v_payment.payment_time - INTERVAL '1 hour')
    FOR UPDATE;

    UPDATE public.qr_payments SET
      status            = 'matched',
      matched_intent_id = v_intent.id,
      matched_user_id   = v_intent.user_id,
      updated_at        = NOW()
    WHERE id = v_payment.id;

    UPDATE public.payment_intents SET
      status              = 'credited',
      matched_payment_id  = v_payment.razorpay_payment_id,
      matched_at          = NOW(),
      updated_at          = NOW()
    WHERE id = v_intent.id;

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
    UPDATE public.qr_payments SET
      status = 'manual_review',
      admin_notes = format('Ambiguous: %s intents match payment VPA %s', v_matching_count, v_clean_vpa),
      updated_at = NOW()
    WHERE id = v_payment.id;

    RETURN jsonb_build_object(
      'success', true,
      'matched', false,
      'status', 'manual_review',
      'reason', 'Multiple intents match this VPA'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'matched', false,
    'status', 'unmatched',
    'reason', 'Awaiting audience claim or manual match'
  );
END;
$$;

-- ============================================================
-- 6. RPC: ADMIN ADJUST USER POINTS (Emergency / Problem Resolution)
-- Admin can add or adjust points for any audience user directly
-- ============================================================
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

  -- Verify admin privileges
  IF NOT (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin')
    OR
    EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = (SELECT email FROM auth.users WHERE id = v_admin_id))
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

  -- Append to audit_logs
  INSERT INTO public.audit_logs (
    event_id,
    admin_id,
    action,
    target_id,
    metadata
  ) VALUES (
    p_event_id,
    v_admin_id,
    'admin_points_grant',
    p_user_id,
    jsonb_build_object(
      'target_user_id', p_user_id,
      'points_adjusted', p_points,
      'rupee_amount', p_rupee_amount,
      'reason', p_reason,
      'new_balance', v_new_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'purchased_points', v_new_purchased,
    'message', format('Successfully added %s points to user.', p_points)
  );
END;
$$;

-- ============================================================
-- 7. RPC: GET ADMIN USERS LIST
-- Lists all audience members with wallet balances for admin desk
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_users_list(
  p_event_id UUID DEFAULT '11111111-0000-0000-0000-000000000001'::uuid
)
RETURNS TABLE (
  id                UUID,
  email             TEXT,
  display_name      TEXT,
  role              TEXT,
  upi_id            TEXT,
  wallet_id         UUID,
  free_points       INTEGER,
  purchased_points  INTEGER,
  invested_points   INTEGER,
  available_points  INTEGER,
  total_paid_rupees INTEGER,
  created_at        TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin privileges
  IF NOT (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = (SELECT auth.users.email FROM auth.users WHERE auth.users.id = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.display_name,
    p.role,
    p.upi_id,
    w.id AS wallet_id,
    COALESCE(w.free_points, 0) AS free_points,
    COALESCE(w.purchased_points, 0) AS purchased_points,
    COALESCE(w.invested_points, 0) AS invested_points,
    COALESCE(w.free_points + w.purchased_points, 0) AS available_points,
    COALESCE(w.total_paid_rupees, 0) AS total_paid_rupees,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.wallets w ON w.user_id = p.id AND w.event_id = p_event_id
  ORDER BY p.created_at DESC;
END;
$$;
