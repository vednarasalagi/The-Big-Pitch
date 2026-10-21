-- ============================================================
-- The Big Pitch — Comprehensive RLS & Admin Authorization Fix
-- Migration: 013_fix_rls_auth_users_permission.sql
-- ============================================================
-- Problem:
-- 1. Direct subqueries like `(SELECT email FROM auth.users WHERE ...)`
--    in RLS policies and functions fail with error:
--    `code: '42501', message: 'permission denied for table users'`
--    because the Supabase `authenticated` role is not granted SELECT on `auth.users`.
-- 2. Direct table SELECT queries by admin panel fail or return empty arrays `[]`.
--
-- Solution:
-- 1. Re-define `public.check_is_admin` to be safe and never fail on `auth.users`.
-- 2. Replace all RLS policies referencing `auth.users` with safe JWT / profile checks.
-- 3. Replace all admin RPC verification blocks with safe admin checks.
-- 4. Provide SECURITY DEFINER RPCs for admin payment telemetry:
--    - get_admin_qr_payments()
--    - get_admin_payment_intents()
--    - get_admin_webhook_events()
--    - get_admin_users_list(p_event_id)
-- ============================================================

-- 0. Secure public.check_is_admin helper
CREATE OR REPLACE FUNCTION public.check_is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Check profiles role directly
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin') THEN
    RETURN TRUE;
  END IF;

  -- 2. Get email from profiles or current JWT
  SELECT email INTO v_email FROM public.profiles WHERE id = p_user_id;
  IF v_email IS NULL AND auth.uid() = p_user_id THEN
    v_email := auth.jwt() ->> 'email';
  END IF;

  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 3. Check admin_allowlist
  RETURN EXISTS (
    SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(v_email)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT public.check_is_admin(user_id);
$$;

-- ============================================================
-- 1. RLS Policies: Package QR Codes
-- ============================================================
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

-- ============================================================
-- 2. RLS Policies: Payment Intents
-- ============================================================
DROP POLICY IF EXISTS "intents_admin_all" ON public.payment_intents;
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

-- ============================================================
-- 3. RLS Policies: QR Payments
-- ============================================================
DROP POLICY IF EXISTS "qr_payments_admin_all" ON public.qr_payments;
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

-- ============================================================
-- 4. RLS Policies: Webhook Events
-- ============================================================
DROP POLICY IF EXISTS "webhook_events_admin_all" ON public.webhook_events;
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
-- 5. Storage Bucket Policies (payment-qr-codes)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    DROP POLICY IF EXISTS "Admins can upload payment QR codes" ON storage.objects;
    CREATE POLICY "Admins can upload payment QR codes"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'payment-qr-codes'
      AND (
        public.is_admin(auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
      )
    );

    DROP POLICY IF EXISTS "Admins can update payment QR codes" ON storage.objects;
    CREATE POLICY "Admins can update payment QR codes"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'payment-qr-codes'
      AND (
        public.is_admin(auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
      )
    );

    DROP POLICY IF EXISTS "Admins can delete payment QR codes" ON storage.objects;
    CREATE POLICY "Admins can delete payment QR codes"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'payment-qr-codes'
      AND (
        public.is_admin(auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
      )
    );
  END IF;
END $$;

-- ============================================================
-- 6. RPC: ADMIN UPDATE PACKAGE QR CODE (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_package_qr_code(
  p_package_id   TEXT,
  p_label        TEXT DEFAULT NULL,
  p_rupee_amount INTEGER DEFAULT NULL,
  p_points       INTEGER DEFAULT NULL,
  p_qr_image_url TEXT DEFAULT NULL,
  p_upi_vpa      TEXT DEFAULT NULL,
  p_is_active    BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

  UPDATE public.package_qr_codes
  SET
    label        = COALESCE(p_label, label),
    rupee_amount = COALESCE(p_rupee_amount, rupee_amount),
    points       = COALESCE(p_points, points),
    qr_image_url = CASE WHEN p_qr_image_url IS NOT NULL THEN p_qr_image_url ELSE qr_image_url END,
    upi_vpa      = CASE WHEN p_upi_vpa IS NOT NULL THEN p_upi_vpa ELSE upi_vpa END,
    is_active    = COALESCE(p_is_active, is_active),
    updated_at   = NOW()
  WHERE id = p_package_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 7. RPC: ADMIN MANUAL MATCH PAYMENT (Clean auth check)
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
    RAISE EXCEPTION 'Intent % is already credited', p_intent_id;
  END IF;

  -- 3. Update payment
  UPDATE public.qr_payments SET
    status            = 'matched',
    matched_intent_id = v_intent.id,
    matched_user_id   = v_intent.user_id,
    admin_notes       = COALESCE(p_admin_notes, 'Manually matched by admin'),
    updated_at        = NOW()
  WHERE id = v_payment.id;

  -- 4. Update intent
  UPDATE public.payment_intents SET
    status              = 'credited',
    matched_payment_id  = v_payment.razorpay_payment_id,
    matched_at          = NOW(),
    admin_notes         = COALESCE(p_admin_notes, 'Manually matched by admin'),
    updated_at          = NOW()
  WHERE id = v_intent.id;

  -- 5. Atomically credit wallet
  PERFORM public.credit_purchased_points(
    v_intent.user_id,
    v_intent.event_id,
    v_intent.points_to_credit,
    v_payment.rupee_amount,
    v_intent.id
  );

  RETURN jsonb_build_object(
    'success', true,
    'points_credited', v_intent.points_to_credit,
    'user_id', v_intent.user_id,
    'payment_id', v_payment.razorpay_payment_id,
    'intent_id', v_intent.id
  );
END;
$$;

-- ============================================================
-- 8. RPC: ADMIN ADJUST USER POINTS (Clean auth check)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_adjust_user_points(
  p_user_id      UUID,
  p_event_id     UUID,
  p_points       INTEGER,
  p_rupee_amount INTEGER DEFAULT 0,
  p_reason       TEXT DEFAULT 'Admin Grant'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id        UUID;
  v_wallet_id       UUID;
  v_new_balance     INTEGER;
  v_new_purchased   INTEGER;
  v_user_email      TEXT;
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
    COALESCE(p_reason, 'Manual adjustment by admin'),
    v_admin_id
  );

  SELECT email INTO v_user_email FROM public.profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'points_adjusted', p_points,
    'new_balance', v_new_balance,
    'user_email', v_user_email
  );
END;
$$;

-- ============================================================
-- 9. RPC: GET ADMIN AUDIENCE USERS LIST (Clean auth check)
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
  IF NOT (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
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

-- ============================================================
-- 10. RPCs: ADMIN TELEMETRY DATA FETCH (Bypasses table RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_qr_payments()
RETURNS TABLE (
  id UUID,
  razorpay_payment_id TEXT,
  razorpay_qr_id TEXT,
  amount_paise INTEGER,
  rupee_amount INTEGER,
  currency TEXT,
  payer_vpa TEXT,
  bank_rrn TEXT,
  status TEXT,
  matched_intent_id UUID,
  matched_user_id UUID,
  raw_payload JSONB,
  payment_time TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  matched_user_email TEXT,
  matched_user_display_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required';
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.razorpay_payment_id,
    q.razorpay_qr_id,
    q.amount_paise,
    q.rupee_amount,
    q.currency,
    q.payer_vpa,
    q.bank_rrn,
    q.status,
    q.matched_intent_id,
    q.matched_user_id,
    q.raw_payload,
    q.payment_time,
    q.admin_notes,
    q.created_at,
    q.updated_at,
    p.email AS matched_user_email,
    p.display_name AS matched_user_display_name
  FROM public.qr_payments q
  LEFT JOIN public.profiles p ON p.id = q.matched_user_id
  ORDER BY q.payment_time DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_payment_intents()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  event_id UUID,
  claim_code TEXT,
  rupee_amount INTEGER,
  points_to_credit INTEGER,
  status TEXT,
  user_utr TEXT,
  user_vpa TEXT,
  matched_payment_id TEXT,
  matched_at TIMESTAMPTZ,
  admin_notes TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_email TEXT,
  user_display_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required';
  END IF;

  RETURN QUERY
  SELECT
    pi.id,
    pi.user_id,
    pi.event_id,
    pi.claim_code,
    pi.rupee_amount,
    pi.points_to_credit,
    pi.status,
    pi.user_utr,
    pi.user_vpa,
    pi.matched_payment_id,
    pi.matched_at,
    pi.admin_notes,
    pi.expires_at,
    pi.created_at,
    pi.updated_at,
    p.email AS user_email,
    p.display_name AS user_display_name
  FROM public.payment_intents pi
  LEFT JOIN public.profiles p ON p.id = pi.user_id
  ORDER BY pi.created_at DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_webhook_events()
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  event_id TEXT,
  signature_verified BOOLEAN,
  status TEXT,
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required';
  END IF;

  RETURN QUERY
  SELECT
    w.id,
    w.event_type,
    w.event_id,
    w.signature_verified,
    w.status,
    w.error_message,
    w.payload,
    w.created_at
  FROM public.webhook_events w
  ORDER BY w.created_at DESC
  LIMIT 50;
END;
$$;

-- ============================================================
-- 11. RPC: SUPER ADMIN PERMANENT USER PURGE
-- ============================================================

-- Helper: Check if a user ID is the designated Super Administrator
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Extract email from current JWT if caller is checking themselves
  IF auth.uid() = p_user_id THEN
    v_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  END IF;

  -- 2. Fallback to profiles table
  IF v_email IS NULL OR v_email = '' THEN
    SELECT LOWER(email) INTO v_email FROM public.profiles WHERE id = p_user_id;
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN FALSE;
  END IF;

  -- 3. Permanent hardcoded master super admin (VITE_SUPER_ADMIN_EMAIL)
  IF v_email = 'vednarasalagi@gmail.com' THEN
    RETURN TRUE;
  END IF;

  -- 4. Check if registered as super_admin in admin_allowlist
  RETURN EXISTS (
    SELECT 1 FROM public.admin_allowlist
    WHERE LOWER(email) = v_email AND (role = 'super_admin' OR added_by = 'super_admin_master')
  );
END;
$$;

-- RPC: Permanently delete a user from all tables and auth.users (Super Admin Only)
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_id     UUID;
  v_target_email  TEXT;
  v_target_name   TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 1. Strict Authorization: ONLY Super Admin can delete a user
  IF NOT public.is_super_admin(v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only the designated Super Administrator can delete users';
  END IF;

  -- 2. Prevent Super Admin from deleting themselves
  IF p_target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Safety Violation: You cannot delete your own Super Admin account';
  END IF;

  -- 3. Retrieve target user info for logging & verification
  SELECT email, display_name INTO v_target_email, v_target_name
  FROM public.profiles
  WHERE id = p_target_user_id;

  -- 4. Prevent deleting the permanent Super Admin account
  IF LOWER(COALESCE(v_target_email, '')) = 'vednarasalagi@gmail.com' THEN
    RAISE EXCEPTION 'Safety Violation: The permanent Super Admin account cannot be deleted';
  END IF;

  -- 5. Cascade cleanup of all user-dependent rows in foreign-key safe order:

  -- A. Wallet ledger transactions
  DELETE FROM public.wallet_ledger WHERE user_id = p_target_user_id;

  -- B. Investments made by user
  DELETE FROM public.investments WHERE user_id = p_target_user_id;

  -- C. Event participants
  DELETE FROM public.event_participants WHERE user_id = p_target_user_id;

  -- D. Payment orders
  DELETE FROM public.payment_orders WHERE user_id = p_target_user_id;

  -- E. Payment intents
  DELETE FROM public.payment_intents WHERE user_id = p_target_user_id;

  -- F. Unlink QR payments (preserve financial audit logs while clearing user linkage)
  UPDATE public.qr_payments
  SET matched_user_id = NULL,
      matched_intent_id = NULL,
      status = 'unmatched',
      admin_notes = COALESCE(admin_notes || ' | ', '') || 'Unlinked: attendee account was deleted by super admin'
  WHERE matched_user_id = p_target_user_id;

  -- G. Wallets
  DELETE FROM public.wallets WHERE user_id = p_target_user_id;

  -- H. Audit logs (unlink user from audit logs)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'user_id') THEN
    UPDATE public.audit_logs SET user_id = NULL WHERE user_id = p_target_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'admin_id') THEN
    EXECUTE 'UPDATE public.audit_logs SET admin_id = NULL WHERE admin_id = $1' USING p_target_user_id;
  END IF;

  -- I. Admin allowlist (if they had delegated admin access)
  IF v_target_email IS NOT NULL THEN
    DELETE FROM public.admin_allowlist WHERE LOWER(email) = LOWER(v_target_email);
  END IF;

  -- J. Delete from public.profiles
  DELETE FROM public.profiles WHERE id = p_target_user_id;

  -- K. Delete from auth.users (purges Supabase authentication credentials)
  DELETE FROM auth.users WHERE id = p_target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_user_id', p_target_user_id,
    'deleted_email', v_target_email,
    'deleted_name', v_target_name,
    'message', format('User %s (%s) was permanently deleted.', COALESCE(v_target_name, 'Account'), COALESCE(v_target_email, p_target_user_id::text))
  );
END;
$$;

