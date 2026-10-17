-- ============================================================
-- Pitch Arena — Admin Email Allowlist & Authorization Security
-- Migration: 003_admin_allowlist.sql
-- Run in: Supabase SQL Editor
-- ============================================================

-- 1. Create table for authorized admin emails
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email       TEXT PRIMARY KEY,
  role        TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  notes       TEXT DEFAULT 'Authorized event administrator',
  added_by    TEXT DEFAULT 'super_admin',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on admin_allowlist
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;

-- 2. Enhanced is_admin function that checks profiles table AND admin_allowlist
CREATE OR REPLACE FUNCTION public.check_is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- Get user email from auth.users or profiles
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = p_user_id;
  END IF;

  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Return true if user profile already has role = 'admin'
  -- OR if the email exists in public.admin_allowlist
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(v_email)
  );
END;
$$;

-- 3. Update public.is_admin helper used by RLS policies
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.check_is_admin(user_id);
$$;

-- 4. Secure RPC function called by authenticated client to verify & sync admin role
CREATE OR REPLACE FUNCTION public.verify_admin_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email   TEXT;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('isAdmin', FALSE, 'error', 'unauthenticated');
  END IF;

  -- Retrieve email from auth token or auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    v_email := auth.jwt() ->> 'email';
  END IF;

  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(v_email)
  ) THEN
    v_is_admin := TRUE;
    -- Synchronize profile role to admin
    UPDATE public.profiles
    SET role = 'admin', updated_at = NOW()
    WHERE id = v_user_id;
  ELSE
    -- Check if existing profile role is admin
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.profiles
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'isAdmin', COALESCE(v_is_admin, FALSE),
    'email', v_email,
    'userId', v_user_id
  );
END;
$$;

-- 5. Trigger: Automatically assign 'admin' role on user signup if email is in allowlist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT := 'audience';
BEGIN
  IF NEW.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(NEW.email)
  ) THEN
    v_role := 'admin';
  END IF;

  INSERT INTO public.profiles (id, email, display_name, avatar_url, role, is_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'User'),
    NEW.raw_user_meta_data->>'avatar_url',
    v_role,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE)
  )
  ON CONFLICT (id) DO UPDATE SET
    role = CASE WHEN v_role = 'admin' THEN 'admin' ELSE public.profiles.role END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- 6. RLS Policies for admin_allowlist
-- Only verified admins can read the allowlist
CREATE POLICY "admin_allowlist_select"
  ON public.admin_allowlist FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Only verified admins can insert/update/delete allowlist
CREATE POLICY "admin_allowlist_write"
  ON public.admin_allowlist FOR ALL
  USING (public.is_admin(auth.uid()));
