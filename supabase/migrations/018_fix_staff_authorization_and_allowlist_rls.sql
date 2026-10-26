-- ============================================================
-- 018_fix_staff_authorization_and_allowlist_rls.sql
-- Fixes staff authorization (Admin & Member roles)
-- 1. Updates admin_allowlist RLS so users can check their own staff status
-- 2. Creates SECURITY DEFINER RPC public.grant_staff_role()
-- 3. Creates SECURITY DEFINER RPC public.get_my_staff_status()
-- 4. Ensures profiles table can be updated when staff roles are granted
-- ============================================================

-- 0. Ensure updated_at column exists on admin_allowlist
ALTER TABLE public.admin_allowlist 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 1. Allow authenticated users to view their own allowlist row
DROP POLICY IF EXISTS "admin_allowlist_select" ON public.admin_allowlist;
DROP POLICY IF EXISTS "allowlist_select" ON public.admin_allowlist;

CREATE POLICY "admin_allowlist_select" ON public.admin_allowlist
  FOR SELECT TO authenticated
  USING (
    public.check_is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
  );

-- 2. Allow admins to insert/update/delete admin_allowlist
DROP POLICY IF EXISTS "admin_allowlist_admin_modify" ON public.admin_allowlist;
CREATE POLICY "admin_allowlist_admin_modify" ON public.admin_allowlist
  FOR ALL TO authenticated
  USING (
    public.check_is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    public.check_is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Function to grant staff role (Admin or Member) with SECURITY DEFINER
-- This bypasses client RLS so the target user's profile is immediately updated
CREATE OR REPLACE FUNCTION public.grant_staff_role(
  p_email TEXT,
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_normalized TEXT := LOWER(TRIM(p_email));
  v_caller_is_admin BOOLEAN := FALSE;
BEGIN
  IF p_email IS NULL OR v_normalized = '' OR p_role NOT IN ('admin', 'member') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email or role specified');
  END IF;

  -- Caller must be admin or super admin
  v_caller_is_admin := public.check_is_admin(auth.uid());
  IF NOT v_caller_is_admin THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
      v_caller_is_admin := TRUE;
    END IF;
  END IF;

  IF NOT v_caller_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only administrators can grant staff access');
  END IF;

  -- 1. Upsert into admin_allowlist
  INSERT INTO public.admin_allowlist (email, role, added_by, notes, updated_at)
  VALUES (
    v_normalized,
    p_role,
    COALESCE(auth.jwt()->>'email', 'admin'),
    'Granted from Admin Dashboard',
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    updated_at = NOW();

  -- 2. Update profiles table if user is already registered
  UPDATE public.profiles
  SET
    role = p_role,
    entry_verified = CASE WHEN p_role = 'admin' THEN TRUE ELSE entry_verified END,
    updated_at = NOW()
  WHERE LOWER(email) = v_normalized;

  RETURN jsonb_build_object('success', true, 'email', v_normalized, 'role', p_role);
END;
$$;

-- 4. Function for the currently authenticated user to fetch & sync their staff role
CREATE OR REPLACE FUNCTION public.get_my_staff_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT := LOWER(auth.jwt()->>'email');
  v_role TEXT := 'audience';
  v_allowlist_role TEXT;
  v_entry_verified BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'authenticated', false,
      'role', 'audience',
      'is_staff', false,
      'is_admin', false,
      'is_member', false
    );
  END IF;

  -- Check current profile
  SELECT role, entry_verified INTO v_role, v_entry_verified
  FROM public.profiles
  WHERE id = v_user_id;

  -- Check admin_allowlist
  IF v_email IS NOT NULL AND v_email != '' THEN
    SELECT role INTO v_allowlist_role
    FROM public.admin_allowlist
    WHERE LOWER(email) = v_email;

    -- If allowlist has admin or member, it takes priority and auto-upgrades the profile
    IF v_allowlist_role IN ('admin', 'member') THEN
      v_role := v_allowlist_role;
      IF v_role = 'admin' THEN
        v_entry_verified := TRUE;
      END IF;

      -- Sync back to profiles table
      UPDATE public.profiles
      SET
        role = v_role,
        entry_verified = CASE WHEN v_role = 'admin' THEN TRUE ELSE entry_verified END,
        updated_at = NOW()
      WHERE id = v_user_id;
    END IF;
  END IF;

  IF v_role IS NULL THEN
    v_role := 'audience';
  END IF;

  RETURN jsonb_build_object(
    'authenticated', true,
    'role', v_role,
    'is_staff', (v_role IN ('admin', 'member')),
    'is_admin', (v_role = 'admin'),
    'is_member', (v_role = 'member'),
    'entry_verified', v_entry_verified
  );
END;
$$;

-- 5. Update check_is_admin to check role = 'admin' in admin_allowlist
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

  -- 3. Check admin_allowlist for admin role specifically
  RETURN EXISTS (
    SELECT 1 FROM public.admin_allowlist
    WHERE LOWER(email) = LOWER(v_email)
      AND (role = 'admin' OR role IS NULL)
  );
END;
$$;
