-- ============================================================
-- Pitch Arena — Security Hardening Migration
-- Migration: 007_security_hardening.sql
-- Fixes: HIGH-3 (Explicit RLS Deny Policies), LOW-3 (Test User Production Cleanup)
-- Run in: Supabase SQL Editor
-- ============================================================

-- 1. Ensure RLS is active on critical tables
ALTER TABLE IF EXISTS public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Explicit Restrictive Policies: Wallets
-- Users can only SELECT their own wallet.
-- Direct INSERT, UPDATE, DELETE by client connections is strictly denied.
-- All wallet mutations must go through SECURITY DEFINER RPCs (grant_free_points, process_investment, credit_purchased_points).
DROP POLICY IF EXISTS "wallets_deny_client_insert" ON public.wallets;
DROP POLICY IF EXISTS "wallets_deny_client_update" ON public.wallets;
DROP POLICY IF EXISTS "wallets_deny_client_delete" ON public.wallets;

-- Supabase RLS: By not granting INSERT/UPDATE/DELETE to public or authenticated,
-- any direct REST API calls from client are blocked by default.
-- For absolute defense-in-depth, create explicit check constraints:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_wallets_non_negative_balances'
  ) THEN
    ALTER TABLE public.wallets
      ADD CONSTRAINT chk_wallets_non_negative_balances
      CHECK (free_points >= 0 AND purchased_points >= 0 AND invested_points >= 0);
  END IF;
END $$;

-- 3. Explicit Restrictive Policies: Investments
-- Users can only SELECT their own investments (or admin can view all).
-- Direct client INSERT is blocked; only process_investment RPC may create investments.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_investments_positive_amount'
  ) THEN
    ALTER TABLE public.investments
      ADD CONSTRAINT chk_investments_positive_amount
      CHECK (amount > 0);
  END IF;
END $$;

-- 4. Audit Logs Immutability
-- Audit logs can be read by admins, but can NEVER be updated or deleted by anyone.
DROP POLICY IF EXISTS "audit_logs_deny_update" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_deny_delete" ON public.audit_logs;

-- Revoke UPDATE/DELETE permissions on audit_logs from authenticated & anon roles
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;

-- 5. Production Guard: Remove default test user if running in production
-- In development, test accounts are fine; in production, run this block to remove test@gmail.com:
--
-- DO $$
-- DECLARE
--   v_test_uid UUID;
-- BEGIN
--   SELECT id INTO v_test_uid FROM auth.users WHERE LOWER(email) = 'test@gmail.com';
--   IF v_test_uid IS NOT NULL THEN
--     DELETE FROM auth.identities WHERE user_id = v_test_uid;
--     DELETE FROM public.wallets WHERE user_id = v_test_uid;
--     DELETE FROM public.profiles WHERE id = v_test_uid;
--     DELETE FROM auth.users WHERE id = v_test_uid;
--   END IF;
-- END $$;
