-- ============================================================
-- Pitch Arena — Complete Database Schema
-- Migration: 001_initial_schema.sql
-- Run in: Supabase SQL Editor
-- ============================================================

-- Enable required extensions
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
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. EVENTS
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

-- ============================================================
-- 3. EVENT CONFIGURATION
-- ============================================================
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

-- ============================================================
-- 4. EVENT PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_participants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES public.events(id),
  user_id     UUID NOT NULL REFERENCES public.profiles(id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

-- ============================================================
-- 5. TEAMS
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

-- ============================================================
-- 6. PITCH ROUNDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pitch_rounds (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id                    UUID NOT NULL REFERENCES public.events(id),
  team_id                     UUID NOT NULL REFERENCES public.teams(id),
  status                      TEXT NOT NULL DEFAULT 'scheduled'
                              CHECK (status IN ('scheduled','announced','investment_open',
                                                'investment_paused','investment_closed','completed')),
  pitch_start_time            TIMESTAMPTZ,
  investment_open_time        TIMESTAMPTZ,
  investment_close_time       TIMESTAMPTZ,     -- server-authoritative deadline
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
-- 7. WALLETS
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

-- ============================================================
-- 8. WALLET LEDGER (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id       UUID NOT NULL REFERENCES public.wallets(id),
  user_id         UUID NOT NULL REFERENCES public.profiles(id),
  event_id        UUID NOT NULL REFERENCES public.events(id),
  type            TEXT NOT NULL CHECK (type IN ('free_grant','purchase','investment',
                                                'investment_refund','admin_adjustment','purchase_refund')),
  amount          INTEGER NOT NULL,        -- positive = credit, negative = debit
  balance_after   INTEGER NOT NULL CHECK (balance_after >= 0),
  description     TEXT NOT NULL DEFAULT '',
  reference_id    UUID,                    -- investment_id or payment_order_id
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No UPDATE, DELETE allowed via RLS
);

CREATE INDEX IF NOT EXISTS wallet_ledger_wallet_id_idx ON public.wallet_ledger(wallet_id);
CREATE INDEX IF NOT EXISTS wallet_ledger_user_id_idx   ON public.wallet_ledger(user_id);

-- ============================================================
-- 9. INVESTMENTS
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

-- Unique per user-round if multiple investments disabled (conditional via app logic)
-- Single investment per round constraint enforced in edge function

-- ============================================================
-- 10. PAYMENT ORDERS
-- ============================================================
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
-- 11. REWARDS
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

-- ============================================================
-- 12. AUDIT LOGS (append-only, immutable via RLS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES public.events(id),
  admin_id    UUID NOT NULL REFERENCES public.profiles(id),
  action      TEXT NOT NULL,
  target_id   UUID,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_event_id_idx ON public.audit_logs(event_id);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Helper function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = user_id AND role = 'admin'
  );
$$;

-- ── Profiles ──────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())  -- role cannot be self-changed
  );

-- ── Events (public read) ──────────────────────────────────
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_public_read" ON public.events FOR SELECT USING (TRUE);
CREATE POLICY "events_admin_write" ON public.events FOR ALL
  USING (public.is_admin(auth.uid()));

-- ── Event Config (public read, admin write) ───────────────
ALTER TABLE public.event_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_config_public_read" ON public.event_config FOR SELECT USING (TRUE);
CREATE POLICY "event_config_admin_write" ON public.event_config FOR ALL
  USING (public.is_admin(auth.uid()));

-- ── Teams (public read) ───────────────────────────────────
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_public_read" ON public.teams FOR SELECT USING (TRUE);
CREATE POLICY "teams_admin_write" ON public.teams FOR ALL
  USING (public.is_admin(auth.uid()));

-- ── Pitch Rounds (public read) ────────────────────────────
ALTER TABLE public.pitch_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rounds_public_read"  ON public.pitch_rounds FOR SELECT USING (TRUE);
CREATE POLICY "rounds_admin_write"  ON public.pitch_rounds FOR ALL
  USING (public.is_admin(auth.uid()));

-- ── Wallets (own only, no direct writes) ──────────────────
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_select_own"  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
-- No INSERT/UPDATE/DELETE for regular users — only edge functions via service role

-- ── Wallet Ledger (own read-only, append by service role) ─
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_select_own"   ON public.wallet_ledger FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
-- No INSERT/UPDATE/DELETE for regular users — append only via service role

-- ── Investments (own read, service role write) ────────────
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "investments_select_own" ON public.investments FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- ── Payment Orders (own read-only) ───────────────────────
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_orders_own" ON public.payment_orders FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- ── Rewards (own read) ────────────────────────────────────
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards_own" ON public.rewards FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "rewards_claim" ON public.rewards FOR UPDATE
  USING (auth.uid() = user_id AND claimed = FALSE)
  WITH CHECK (
    claimed = TRUE
    AND claimed_at IS NOT NULL
  );

-- ── Audit Logs (admin read only, service role write) ──────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_read" ON public.audit_logs FOR SELECT
  USING (public.is_admin(auth.uid()));
-- No user-initiated writes — only via service role

-- ============================================================
-- SEED DATA (Development / Demo)
-- ============================================================

-- Insert demo event
INSERT INTO public.events (id, name, tagline, status, start_time) VALUES
  ('11111111-0000-0000-0000-000000000001',
   'Pitch Arena 2025',
   'Where ideas meet capital — audience edition',
   'investment_open',
   NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

-- Insert event config
INSERT INTO public.event_config (event_id, free_points_allocation, points_per_rupee, max_paid_purchase_rupees, max_paid_points) VALUES
  ('11111111-0000-0000-0000-000000000001', 500, 10, 100, 1000)
ON CONFLICT (event_id) DO NOTHING;

-- Insert sample teams
INSERT INTO public.teams (id, event_id, name, pitch_title, description, category, presenters, pitch_order, status, total_investment, unique_backers) VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'EcoSpark', 'Solar-Powered Smart Water Purifier',
   'Affordable solar purifier for rural India using AI-driven contaminant detection.',
   'CleanTech', '{"Priya Sharma","Rohit Gupta"}', 1, 'active', 4820, 67),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001',
   'NeuroBridge', 'AI Mental Health Companion for Students',
   'Personalized AI therapy companion using NLP and voice patterns.',
   'HealthTech', '{"Ananya Patel","Dev Mehta"}', 2, 'completed', 6230, 89),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001',
   'FarmFlow', 'Blockchain Agricultural Supply Chain',
   'End-to-end traceability using IoT sensors and blockchain.',
   'AgriTech', '{"Karan Singh","Meera Joshi"}', 3, 'upcoming', 3150, 45),
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001',
   'CraftConnect', 'Global Marketplace for Indian Artisans',
   'AR-powered platform for Indian handicrafts.',
   'E-Commerce', '{"Shruti Agarwal","Vijay Kumar"}', 4, 'upcoming', 2890, 38),
  ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001',
   'SkillForge', 'Hyper-Personalized Vocational Training',
   'Adaptive ML learning for blue-collar workers.',
   'EdTech', '{"Arjun Nair","Pooja Reddy"}', 5, 'upcoming', 1940, 27)
ON CONFLICT (id) DO NOTHING;
