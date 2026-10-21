-- ============================================================
-- The Big Pitch — Super Admin Permanent User Purge
-- Migration: 014_super_admin_delete_user.sql
-- ============================================================
-- Allows ONLY the designated Super Administrator to permanently
-- delete any user account and its entire cascade of data:
-- - Wallets and wallet ledger entries
-- - Investments and pitch participations
-- - Payment intents and orders
-- - Unlinks QR payment records (keeps financial audit trail)
-- - Deletes public.profiles row
-- - Purges auth.users (removes login/credentials completely)
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
