-- ============================================================
-- The Big Pitch — Admin payment-mode toggle + Razorpay portal orders
-- Migration: 022_payment_mode_toggle_and_portal_orders.sql
--
-- 1. payment_settings: admin-controlled mode per event ('qr' | 'portal')
-- 2. payment_orders: reservation/idempotency columns for portal checkout
-- 3. reserve / fail / finalize / complete RPCs for the portal flow
-- 4. Server-side enforcement: QR claims are refused in portal mode and
--    portal orders are refused in QR mode.
-- 5. Lock down credit_purchased_points (server-only).
-- ============================================================

-- ============================================================
-- 1. PAYMENT SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_settings (
  event_id    UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  mode        TEXT NOT NULL DEFAULT 'qr' CHECK (mode IN ('qr', 'portal')),
  updated_by  UUID,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_settings_read" ON public.payment_settings;
CREATE POLICY "payment_settings_read" ON public.payment_settings
  FOR SELECT TO anon, authenticated USING (TRUE);
-- No write policies: writes only through admin_set_payment_mode().

INSERT INTO public.payment_settings (event_id, mode)
SELECT id, 'qr' FROM public.events
ON CONFLICT (event_id) DO NOTHING;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_settings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.get_payment_mode(p_event_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT mode FROM public.payment_settings WHERE event_id = p_event_id),
    'qr'
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_set_payment_mode(
  p_event_id UUID,
  p_mode     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
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

  IF p_mode NOT IN ('qr', 'portal') THEN
    RAISE EXCEPTION 'Invalid payment mode';
  END IF;

  INSERT INTO public.payment_settings (event_id, mode, updated_by, updated_at)
  VALUES (p_event_id, p_mode, v_admin_id, NOW())
  ON CONFLICT (event_id) DO UPDATE
    SET mode = EXCLUDED.mode, updated_by = EXCLUDED.updated_by, updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'mode', p_mode);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_mode(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_payment_mode(UUID, TEXT) TO authenticated;

-- ============================================================
-- 2. PAYMENT ORDERS: portal reservation columns
-- ============================================================
ALTER TABLE public.payment_orders ALTER COLUMN razorpay_order_id DROP NOT NULL;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS request_id     UUID;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS payment_mode   TEXT;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS failure_reason TEXT;

ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_status_check;
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_status_check
  CHECK (status IN ('creating','created','pending','success','failed','cancelled','refunded'));

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_user_request_uidx
  ON public.payment_orders(user_id, request_id) WHERE request_id IS NOT NULL;

-- ============================================================
-- 3. PORTAL RPCs (replace the legacy stubs from migration 010)
-- ============================================================
DROP FUNCTION IF EXISTS public.reserve_payment_order(UUID, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.fail_payment_order(UUID, TEXT);
DROP FUNCTION IF EXISTS public.finalize_payment_order(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.reserve_payment_order(
  p_user_id       UUID,
  p_event_id      UUID,
  p_rupee_amount  INTEGER,
  p_request_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_config    public.event_config%ROWTYPE;
  v_wallet    public.wallets%ROWTYPE;
  v_existing  public.payment_orders%ROWTYPE;
  v_reserved  INTEGER;
  v_paid      INTEGER;
  v_points    INTEGER;
  v_order_id  UUID;
  v_has_pkgs  BOOLEAN;
BEGIN
  IF p_rupee_amount IS NULL OR p_rupee_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_PURCHASE_AMOUNT';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'INVALID_EVENT';
  END IF;

  IF public.get_payment_mode(p_event_id) <> 'portal' THEN
    RAISE EXCEPTION 'PORTAL_DISABLED';
  END IF;

  -- Serialise purchases per user so the cap check cannot be raced.
  PERFORM pg_advisory_xact_lock(hashtext('payment_orders:' || p_user_id::TEXT));

  -- Idempotent retry of the same request.
  SELECT * INTO v_existing FROM public.payment_orders
  WHERE user_id = p_user_id AND request_id = p_request_id;

  IF FOUND THEN
    IF v_existing.rupee_amount <> p_rupee_amount OR v_existing.event_id <> p_event_id THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED';
    END IF;
    RETURN jsonb_build_object(
      'reservation_id', v_existing.id,
      'rupee_amount', v_existing.rupee_amount,
      'points_to_credit', v_existing.points_to_credit,
      'status', CASE WHEN v_existing.status IN ('creating','created','failed')
                     THEN v_existing.status ELSE 'failed' END,
      'razorpay_order_id', v_existing.razorpay_order_id,
      'created_now', FALSE
    );
  END IF;

  SELECT * INTO v_config FROM public.event_config WHERE event_id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'EVENT_CONFIG_NOT_FOUND'; END IF;
  IF v_config.points_per_rupee IS NULL OR v_config.points_per_rupee <= 0 THEN
    RAISE EXCEPTION 'EVENT_CONFIG_INVALID';
  END IF;

  -- Amount must be one of the active packages (when packages are configured).
  SELECT EXISTS (SELECT 1 FROM public.package_qr_codes WHERE event_id = p_event_id AND is_active)
    INTO v_has_pkgs;
  IF v_has_pkgs AND NOT EXISTS (
    SELECT 1 FROM public.package_qr_codes
    WHERE event_id = p_event_id AND is_active AND rupee_amount = p_rupee_amount
  ) THEN
    RAISE EXCEPTION 'INVALID_PURCHASE_AMOUNT';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets
  WHERE user_id = p_user_id AND event_id = p_event_id;
  v_paid := COALESCE(v_wallet.total_paid_rupees, 0);

  -- Cap = already credited + unexpired in-flight reservations + this purchase.
  SELECT COALESCE(SUM(rupee_amount), 0) INTO v_reserved
  FROM public.payment_orders
  WHERE user_id = p_user_id AND event_id = p_event_id
    AND status IN ('creating','created','pending')
    AND created_at > NOW() - INTERVAL '30 minutes';

  IF v_paid + v_reserved + p_rupee_amount > v_config.max_paid_purchase_rupees THEN
    RAISE EXCEPTION 'PURCHASE_CAP_EXCEEDED';
  END IF;

  v_points := p_rupee_amount * v_config.points_per_rupee;

  INSERT INTO public.payment_orders (
    user_id, event_id, rupee_amount, points_to_credit, status, request_id, payment_mode
  ) VALUES (
    p_user_id, p_event_id, p_rupee_amount, v_points, 'creating', p_request_id, 'razorpay'
  ) RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'reservation_id', v_order_id,
    'rupee_amount', p_rupee_amount,
    'points_to_credit', v_points,
    'status', 'creating',
    'razorpay_order_id', NULL,
    'created_now', TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_payment_order(
  p_reservation_id UUID,
  p_reason         TEXT DEFAULT 'failed'
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.payment_orders
  SET status = 'failed', failure_reason = p_reason, updated_at = NOW()
  WHERE id = p_reservation_id AND status IN ('creating','created');
$$;

CREATE OR REPLACE FUNCTION public.finalize_payment_order(
  p_reservation_id    UUID,
  p_razorpay_order_id TEXT,
  p_payment_mode      TEXT DEFAULT 'razorpay'
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.payment_orders
  SET razorpay_order_id = p_razorpay_order_id,
      payment_mode      = p_payment_mode,
      status            = 'created',
      updated_at        = NOW()
  WHERE id = p_reservation_id AND status = 'creating';
$$;

-- Atomically confirm a paid order and credit points exactly once.
-- Called by verify-payment (checkout signature) and payment-webhook.
CREATE OR REPLACE FUNCTION public.complete_payment_order(
  p_razorpay_order_id TEXT,
  p_payment_id        TEXT,
  p_signature         TEXT    DEFAULT NULL,
  p_amount_paise      INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.payment_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.payment_orders
  WHERE razorpay_order_id = p_razorpay_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND');
  END IF;

  IF v_order.status = 'success' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true,
      'points', v_order.points_to_credit, 'rupees', v_order.rupee_amount);
  END IF;

  IF v_order.status NOT IN ('created','pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_PAYABLE', 'status', v_order.status);
  END IF;

  IF p_amount_paise IS NOT NULL AND p_amount_paise <> v_order.rupee_amount * 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'AMOUNT_MISMATCH');
  END IF;

  UPDATE public.payment_orders
  SET status = 'success',
      razorpay_payment_id = p_payment_id,
      razorpay_signature  = COALESCE(p_signature, razorpay_signature),
      updated_at = NOW()
  WHERE id = v_order.id;

  PERFORM public.credit_purchased_points(
    v_order.user_id, v_order.event_id, v_order.points_to_credit,
    v_order.rupee_amount, v_order.id
  );

  RETURN jsonb_build_object('success', true, 'already_processed', false,
    'points', v_order.points_to_credit, 'rupees', v_order.rupee_amount);
END;
$$;

-- Server-only: never callable from the browser.
REVOKE ALL ON FUNCTION public.reserve_payment_order(UUID, UUID, INTEGER, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_payment_order(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_payment_order(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_payment_order(TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_purchased_points(UUID, UUID, INTEGER, INTEGER, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_payment_order(UUID, UUID, INTEGER, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_payment_order(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_payment_order(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_payment_order(TEXT, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_purchased_points(UUID, UUID, INTEGER, INTEGER, UUID) TO service_role;

-- ============================================================
-- 4. QR FLOW GATE: refuse new QR claims while in portal mode
-- ============================================================
-- The original function keeps all its logic; a thin wrapper enforces the mode.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_payment_intent_impl'
  ) THEN
    ALTER FUNCTION public.create_payment_intent(UUID, INTEGER) RENAME TO create_payment_intent_impl;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.create_payment_intent_impl(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_event_id      UUID,
  p_rupee_amount  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
BEGIN
  IF public.get_payment_mode(p_event_id) <> 'qr' THEN
    RAISE EXCEPTION 'QR payments are currently disabled. Please use the online payment portal.';
  END IF;
  RETURN public.create_payment_intent_impl(p_event_id, p_rupee_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_payment_intent(UUID, INTEGER) TO authenticated;
