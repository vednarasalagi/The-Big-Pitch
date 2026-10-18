-- ============================================================
-- Pitch Arena — Complete All-In-One Database Setup
-- Run this entire script in Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'audience' CHECK (role IN ('admin', 'audience')),
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, is_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'User'),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. ADMIN ALLOWLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email       TEXT PRIMARY KEY,
  role        TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  notes       TEXT DEFAULT 'Authorized event administrator',
  added_by    TEXT DEFAULT 'super_admin',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin verification functions
CREATE OR REPLACE FUNCTION public.check_is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = p_user_id;
  END IF;

  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(v_email)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.check_is_admin(user_id);
$$;

CREATE OR REPLACE FUNCTION public.verify_admin_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_email   TEXT;
  v_is_adm  BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('isAdmin', FALSE, 'error', 'Not authenticated');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_user_id;
  END IF;

  v_is_adm := public.check_is_admin(v_user_id);

  IF v_is_adm THEN
    UPDATE public.profiles
    SET role = 'admin', updated_at = NOW()
    WHERE id = v_user_id AND role != 'admin';
  END IF;

  RETURN jsonb_build_object(
    'isAdmin', v_is_adm,
    'email', v_email,
    'userId', v_user_id
  );
END;
$$;

-- ============================================================
-- 3. EVENTS & EVENT CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  tagline     TEXT,
  logo_url    TEXT,
  banner_url  TEXT,
  status      TEXT NOT NULL DEFAULT 'not_started'
              CHECK (status IN ('not_started','upcoming','announced','investment_open',
                                'investment_paused','investment_closed','results_published','completed')),
  start_time  TIMESTAMPTZ,
  end_time    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_config (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id                    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
  free_points_allocation      INTEGER NOT NULL DEFAULT 500 CHECK (free_points_allocation >= 0),
  points_per_rupee            INTEGER NOT NULL DEFAULT 10  CHECK (points_per_rupee > 0),
  max_paid_purchase_rupees    INTEGER NOT NULL DEFAULT 100 CHECK (max_paid_purchase_rupees >= 0),
  max_paid_points             INTEGER NOT NULL DEFAULT 1000,
  allowed_purchase_amounts    INTEGER[] NOT NULL DEFAULT '{50,100,200,500,1000}',
  min_investment_amount       INTEGER NOT NULL DEFAULT 10  CHECK (min_investment_amount > 0),
  max_investment_amount       INTEGER NOT NULL DEFAULT 500,
  allow_multiple_investments  BOOLEAN NOT NULL DEFAULT TRUE,
  pitch_duration_seconds      INTEGER NOT NULL DEFAULT 300,
  investment_window_seconds   INTEGER NOT NULL DEFAULT 180,
  blind_leaderboard           BOOLEAN NOT NULL DEFAULT FALSE,
  allowed_email_domains       TEXT[] NOT NULL DEFAULT '{}',
  reward_rules                JSONB NOT NULL DEFAULT '[]',
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_participants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES public.events(id),
  user_id     UUID NOT NULL REFERENCES public.profiles(id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

-- ============================================================
-- 4. TEAMS & PITCH ROUNDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id                    UUID NOT NULL REFERENCES public.events(id),
  name                        TEXT NOT NULL,
  logo_url                    TEXT,
  pitch_title                 TEXT NOT NULL,
  description                 TEXT NOT NULL DEFAULT '',
  category                    TEXT NOT NULL DEFAULT '',
  presenters                  TEXT[] NOT NULL DEFAULT '{}',
  pitch_order                 INTEGER NOT NULL DEFAULT 0,
  status                      TEXT NOT NULL DEFAULT 'upcoming'
                              CHECK (status IN ('upcoming','active','closed','completed')),
  pitch_duration_seconds      INTEGER,
  investment_window_seconds   INTEGER,
  total_investment            INTEGER NOT NULL DEFAULT 0 CHECK (total_investment >= 0),
  unique_backers              INTEGER NOT NULL DEFAULT 0 CHECK (unique_backers >= 0),
  is_archived                 BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS teams_event_id_idx ON public.teams(event_id);
CREATE INDEX IF NOT EXISTS teams_pitch_order_idx ON public.teams(event_id, pitch_order);

CREATE TABLE IF NOT EXISTS public.pitch_rounds (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id                    UUID NOT NULL REFERENCES public.events(id),
  team_id                     UUID NOT NULL REFERENCES public.teams(id),
  status                      TEXT NOT NULL DEFAULT 'scheduled'
                              CHECK (status IN ('scheduled','announced','investment_open',
                                                'investment_paused','investment_closed','completed')),
  pitch_start_time            TIMESTAMPTZ,
  investment_open_time        TIMESTAMPTZ,
  investment_close_time       TIMESTAMPTZ,
  investment_pause_time       TIMESTAMPTZ,
  scheduled_duration_seconds  INTEGER NOT NULL DEFAULT 300,
  investment_window_seconds   INTEGER NOT NULL DEFAULT 180,
  total_invested              INTEGER NOT NULL DEFAULT 0 CHECK (total_invested >= 0),
  unique_investors            INTEGER NOT NULL DEFAULT 0 CHECK (unique_investors >= 0),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pitch_rounds_event_id_idx ON public.pitch_rounds(event_id);
CREATE INDEX IF NOT EXISTS pitch_rounds_status_idx   ON public.pitch_rounds(status);

-- ============================================================
-- 5. WALLETS & LEDGER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wallets (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id),
  event_id              UUID NOT NULL REFERENCES public.events(id),
  free_points           INTEGER NOT NULL DEFAULT 0 CHECK (free_points >= 0),
  purchased_points      INTEGER NOT NULL DEFAULT 0 CHECK (purchased_points >= 0),
  invested_points       INTEGER NOT NULL DEFAULT 0 CHECK (invested_points >= 0),
  total_spent_points    INTEGER NOT NULL DEFAULT 0 CHECK (total_spent_points >= 0),
  total_paid_rupees     INTEGER NOT NULL DEFAULT 0 CHECK (total_paid_rupees >= 0),
  free_points_granted   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS wallets_user_id_idx  ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS wallets_event_id_idx ON public.wallets(event_id);

CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id       UUID NOT NULL REFERENCES public.wallets(id),
  user_id         UUID NOT NULL REFERENCES public.profiles(id),
  event_id        UUID NOT NULL REFERENCES public.events(id),
  type            TEXT NOT NULL CHECK (type IN ('free_grant','purchase','investment',
                                                'investment_refund','admin_adjustment','purchase_refund')),
  amount          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL CHECK (balance_after >= 0),
  description     TEXT NOT NULL DEFAULT '',
  reference_id    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wallet_ledger_wallet_id_idx ON public.wallet_ledger(wallet_id);
CREATE INDEX IF NOT EXISTS wallet_ledger_user_id_idx   ON public.wallet_ledger(user_id);

-- ============================================================
-- 6. INVESTMENTS & PAYMENT ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.investments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id),
  event_id    UUID NOT NULL REFERENCES public.events(id),
  team_id     UUID NOT NULL REFERENCES public.teams(id),
  round_id    UUID NOT NULL REFERENCES public.pitch_rounds(id),
  amount      INTEGER NOT NULL CHECK (amount > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS investments_user_id_idx  ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS investments_team_id_idx  ON public.investments(team_id);
CREATE INDEX IF NOT EXISTS investments_round_id_idx ON public.investments(round_id);

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id),
  event_id            UUID NOT NULL REFERENCES public.events(id),
  razorpay_order_id   TEXT NOT NULL UNIQUE,
  rupee_amount        INTEGER NOT NULL CHECK (rupee_amount > 0),
  points_to_credit    INTEGER NOT NULL CHECK (points_to_credit > 0),
  status              TEXT NOT NULL DEFAULT 'created'
                      CHECK (status IN ('created','pending','success','failed','cancelled','refunded')),
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_orders_user_id_idx ON public.payment_orders(user_id);

-- ============================================================
-- 7. REWARDS & AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rewards (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES public.events(id),
  user_id     UUID NOT NULL REFERENCES public.profiles(id),
  rule_id     TEXT NOT NULL,
  badge_type  TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  claimed     BOOLEAN NOT NULL DEFAULT FALSE,
  claim_code  TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  claimed_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  changes     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. STORED PROCEDURES / RPCS
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

  IF v_wallet.free_points >= p_amount THEN
    v_new_free      := v_wallet.free_points - p_amount;
    v_new_purchased := v_wallet.purchased_points;
  ELSE
    v_new_free      := 0;
    v_new_purchased := v_wallet.purchased_points - (p_amount - v_wallet.free_points);
  END IF;

  UPDATE public.wallets SET
    free_points       = v_new_free,
    purchased_points  = v_new_purchased,
    invested_points   = invested_points + p_amount,
    total_spent_points= total_spent_points + p_amount,
    updated_at        = NOW()
  WHERE id = p_wallet_id;

  INSERT INTO public.investments (user_id, event_id, team_id, round_id, amount)
  VALUES (p_user_id, p_event_id, p_team_id, p_round_id, p_amount)
  RETURNING id INTO v_investment_id;

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

  UPDATE public.teams SET
    total_investment = total_investment + p_amount,
    unique_backers   = (
      SELECT COUNT(DISTINCT user_id)
      FROM public.investments
      WHERE team_id = p_team_id
    ),
    updated_at = NOW()
  WHERE id = p_team_id;

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

  INSERT INTO public.wallets (user_id, event_id, free_points, free_points_granted)
  VALUES (p_user_id, p_event_id, v_config.free_points_allocation, TRUE)
  ON CONFLICT (user_id, event_id) DO NOTHING;

  SELECT id INTO v_wallet_id FROM public.wallets
  WHERE user_id = p_user_id AND event_id = p_event_id;

  IF (SELECT free_points_granted FROM public.wallets WHERE id = v_wallet_id) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.wallets SET
    free_points         = free_points + v_config.free_points_allocation,
    free_points_granted = TRUE,
    updated_at          = NOW()
  WHERE id = v_wallet_id;

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

  INSERT INTO public.event_participants (event_id, user_id)
  VALUES (p_event_id, p_user_id)
  ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- 9. ROW-LEVEL SECURITY POLICIES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events_public_read" ON public.events;
CREATE POLICY "events_public_read"  ON public.events FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "events_admin_write" ON public.events;
CREATE POLICY "events_admin_write"  ON public.events FOR ALL
  USING (public.is_admin(auth.uid()));

ALTER TABLE public.event_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "config_public_read" ON public.event_config;
CREATE POLICY "config_public_read"  ON public.event_config FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "config_admin_write" ON public.event_config;
CREATE POLICY "config_admin_write"  ON public.event_config FOR ALL
  USING (public.is_admin(auth.uid()));

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "teams_public_read" ON public.teams;
CREATE POLICY "teams_public_read" ON public.teams FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "teams_admin_write" ON public.teams;
CREATE POLICY "teams_admin_write" ON public.teams FOR ALL
  USING (public.is_admin(auth.uid()));

ALTER TABLE public.pitch_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rounds_public_read" ON public.pitch_rounds;
CREATE POLICY "rounds_public_read"  ON public.pitch_rounds FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "rounds_admin_write" ON public.pitch_rounds;
CREATE POLICY "rounds_admin_write"  ON public.pitch_rounds FOR ALL
  USING (public.is_admin(auth.uid()));

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
CREATE POLICY "wallets_select_own"  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ledger_select_own" ON public.wallet_ledger;
CREATE POLICY "ledger_select_own"   ON public.wallet_ledger FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "investments_select_own" ON public.investments;
CREATE POLICY "investments_select_own" ON public.investments FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_orders_own" ON public.payment_orders;
CREATE POLICY "payment_orders_own" ON public.payment_orders FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rewards_own" ON public.rewards;
CREATE POLICY "rewards_own" ON public.rewards FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "rewards_claim" ON public.rewards;
CREATE POLICY "rewards_claim" ON public.rewards FOR UPDATE
  USING (auth.uid() = user_id AND claimed = FALSE)
  WITH CHECK (claimed = TRUE AND claimed_at IS NOT NULL);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_admin_read" ON public.audit_logs;
CREATE POLICY "audit_admin_read" ON public.audit_logs FOR SELECT
  USING (public.is_admin(auth.uid()));

ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_allowlist_read" ON public.admin_allowlist;
CREATE POLICY "admin_allowlist_read" ON public.admin_allowlist FOR SELECT
  USING (TRUE);
DROP POLICY IF EXISTS "admin_allowlist_write" ON public.admin_allowlist;
CREATE POLICY "admin_allowlist_write" ON public.admin_allowlist FOR ALL
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- 10. INITIAL SEED DATA
-- ============================================================
INSERT INTO public.events (id, name, tagline, status, start_time) VALUES
  ('11111111-0000-0000-0000-000000000001',
   'Pitch Arena 2025',
   'Where ideas meet capital — audience edition',
   'investment_open',
   NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_config (event_id, free_points_allocation, points_per_rupee, max_paid_purchase_rupees, max_paid_points) VALUES
  ('11111111-0000-0000-0000-000000000001', 500, 10, 100, 1000)
ON CONFLICT (event_id) DO NOTHING;

INSERT INTO public.teams (id, event_id, name, pitch_title, description, category, presenters, pitch_order, status, total_investment, unique_backers) VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'EcoSpark', 'Solar-Powered Smart Water Purifier',
   'Affordable solar purifier for rural communities using AI-driven contaminant detection.',
   'CleanTech', '{"Priya Sharma","Rohit Gupta"}', 1, 'active', 4820, 67),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001',
   'NeuroBridge', 'AI Mental Health Companion for Students',
   'Personalized AI therapy companion using NLP and acoustic voice biomarkers.',
   'HealthTech', '{"Ananya Patel","Dev Mehta"}', 2, 'completed', 6230, 89),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001',
   'FarmFlow', 'Blockchain Agricultural Supply Chain',
   'End-to-end farm traceability with decentralized cold-chain IoT tracking.',
   'AgriTech', '{"Karan Singh","Meera Joshi"}', 3, 'upcoming', 3150, 45),
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001',
   'CraftConnect', 'Global Marketplace for Artisans',
   'AR-powered platform showcasing authentic regional crafts with fair-trade pricing.',
   'E-Commerce', '{"Shruti Agarwal","Vijay Kumar"}', 4, 'upcoming', 2890, 38)
ON CONFLICT (id) DO NOTHING;

-- Sync any existing auth users to profiles
INSERT INTO public.profiles (id, email, display_name, role, is_verified)
SELECT 
  id, 
  COALESCE(email, ''), 
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1), 'User'),
  'audience',
  TRUE
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 11. CREATE REAL TEST ACCOUNT: test@gmail.com / test1234
-- ============================================================
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_existing_id UUID;
BEGIN
  -- Check if test@gmail.com already exists in auth.users
  SELECT id INTO v_existing_id FROM auth.users WHERE LOWER(email) = 'test@gmail.com';

  -- 1. Remove any old broken test@gmail.com records completely
  SELECT id INTO v_test_id FROM auth.users WHERE LOWER(email) = 'test@gmail.com';
  IF v_test_id IS NOT NULL THEN
    DELETE FROM auth.identities WHERE user_id = v_test_id;
    DELETE FROM public.wallets WHERE user_id = v_test_id;
    DELETE FROM public.profiles WHERE id = v_test_id;
    DELETE FROM auth.users WHERE id = v_test_id;
  END IF;

  -- 2. Check if a GoTrue-generated user exists to convert directly
  SELECT id INTO v_existing_id FROM auth.users WHERE LOWER(email) = 'alexsmithdev2024@gmail.com';

  IF v_existing_id IS NOT NULL THEN
    UPDATE auth.users
    SET
      email = 'test@gmail.com',
      encrypted_password = crypt('test1234', gen_salt('bf', 10)),
      email_confirmed_at = NOW(),
      confirmed_at = NOW(),
      last_sign_in_at = NOW(),
      updated_at = NOW(),
      raw_user_meta_data = '{"full_name":"Test User"}'::jsonb,
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb
    WHERE id = v_existing_id;

    UPDATE auth.identities
    SET
      identity_data = jsonb_build_object(
        'email', 'test@gmail.com',
        'email_verified', true,
        'phone_verified', false,
        'sub', v_existing_id::text
      ),
      last_sign_in_at = NOW(),
      updated_at = NOW()
    WHERE user_id = v_existing_id;

    v_user_id := v_existing_id;
  ELSE
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      phone,
      phone_change,
      phone_change_token,
      reauthentication_token,
      email_change_token_current,
      email_change_confirm_status,
      is_super_admin,
      is_sso_user,
      is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'test@gmail.com',
      crypt('test1234', gen_salt('bf', 10)),
      NOW(),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Test User"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      0,
      FALSE,
      FALSE,
      FALSE
    );

    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id'
    ) THEN
      EXECUTE 'INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, jsonb_build_object(''email'', ''test@gmail.com'', ''email_verified'', true, ''sub'', $1::text),
        ''email'', $1::text, NOW(), NOW(), NOW()
      )' USING v_user_id;
    ELSE
      EXECUTE 'INSERT INTO auth.identities (
        id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, jsonb_build_object(''email'', ''test@gmail.com'', ''email_verified'', true, ''sub'', $1::text),
        ''email'', NOW(), NOW(), NOW()
      )' USING v_user_id;
    END IF;
  END IF;

  -- Ensure profile exists in public.profiles table
  INSERT INTO public.profiles (id, email, display_name, role, is_verified)
  VALUES (v_user_id, 'test@gmail.com', 'Test User', 'audience', TRUE)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    is_verified = TRUE,
    updated_at = NOW();

  -- Ensure wallet exists with 500 initial audience investment points
  INSERT INTO public.wallets (user_id, event_id, free_points, free_points_granted)
  VALUES (v_user_id, '11111111-0000-0000-0000-000000000001', 500, TRUE)
  ON CONFLICT (user_id, event_id) DO UPDATE SET
    free_points = GREATEST(wallets.free_points, 500);
END $$;

-- ============================================================
-- 12. MASTER SUPER ADMIN ALLOWLIST
-- ============================================================
INSERT INTO public.admin_allowlist (email, role, notes, added_by)
VALUES ('vednarasalagi@gmail.com', 'admin', 'Primary Super Admin', 'system')
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  notes = 'Primary Super Admin';

-- If user profile already exists, elevate role to admin
UPDATE public.profiles
SET role = 'admin', updated_at = NOW()
WHERE LOWER(email) = 'vednarasalagi@gmail.com';
