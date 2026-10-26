-- ============================================================
-- Migration 017: Event Entry Gate Verification & Member (Volunteer) Role
-- Implements single-account enforcement via physical QR verification
-- ============================================================

-- 1. Extend profiles table with entry verification fields and pass code
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS entry_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by TEXT,
  ADD COLUMN IF NOT EXISTS pass_code TEXT;

-- 2. Update role check constraint on profiles to allow 'member' role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'member', 'audience'));

-- 3. Update admin_allowlist table to support both 'admin' and 'member' roles
ALTER TABLE public.admin_allowlist DROP CONSTRAINT IF EXISTS admin_allowlist_role_check;
ALTER TABLE public.admin_allowlist ADD CONSTRAINT admin_allowlist_role_check 
  CHECK (role IN ('admin', 'member'));

-- 4. Function to generate a unique short alphanumeric pass code (e.g. TBP-A8F2)
CREATE OR REPLACE FUNCTION public.generate_tbp_pass_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_chars TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code TEXT;
  v_exists BOOLEAN;
  v_i INT;
BEGIN
  LOOP
    v_code := 'TBP-';
    FOR v_i IN 1..5 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE pass_code = v_code) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

-- 5. Backfill existing profiles with pass_code if missing
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE pass_code IS NULL LOOP
    UPDATE public.profiles
    SET pass_code = public.generate_tbp_pass_code()
    WHERE id = r.id;
  END LOOP;
END $$;

-- Make pass_code unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pass_code_unique'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_pass_code_unique UNIQUE (pass_code);
  END IF;
END $$;

-- 6. Update handle_new_user trigger to assign pass_code and auto-assign member/admin role from allowlist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
  v_role TEXT := 'audience';
  v_verified BOOLEAN := FALSE;
  v_pass_code TEXT;
BEGIN
  -- Generate unique pass code
  v_pass_code := public.generate_tbp_pass_code();

  -- Check if user's email exists in allowlist with custom role (admin or member)
  IF NEW.email IS NOT NULL THEN
    SELECT role INTO v_role 
    FROM public.admin_allowlist 
    WHERE LOWER(email) = LOWER(NEW.email);
    
    IF v_role IS NULL THEN
      v_role := 'audience';
    END IF;

    -- Admins are automatically entry verified
    IF v_role = 'admin' THEN
      v_verified := TRUE;
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id, 
    email, 
    display_name, 
    avatar_url, 
    role, 
    is_verified, 
    entry_verified,
    pass_code,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'User'),
    NEW.raw_user_meta_data->>'avatar_url',
    v_role,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE),
    v_verified,
    v_pass_code,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    pass_code = COALESCE(profiles.pass_code, v_pass_code),
    role = CASE 
      WHEN profiles.role = 'admin' THEN 'admin' 
      WHEN v_role IN ('admin', 'member') THEN v_role 
      ELSE profiles.role 
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- 7. Helper to check if caller is staff (admin or member)
CREATE OR REPLACE FUNCTION public.check_is_staff(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_role TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT email, role INTO v_email, v_role FROM public.profiles WHERE id = p_user_id;
  IF v_email IS NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  END IF;

  IF v_role IN ('admin', 'member') THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.admin_allowlist 
    WHERE LOWER(email) = LOWER(v_email) AND role IN ('admin', 'member')
  );
END;
$$;

-- 8. Secure RPC: Verify Attendee at Event Gate
CREATE OR REPLACE FUNCTION public.verify_attendee_entry(
  p_attendee_id UUID,
  p_verifier_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_verifier_email TEXT;
  v_attendee_email TEXT;
  v_attendee_name TEXT;
BEGIN
  -- Authenticate caller
  IF v_caller_id IS NULL AND p_verifier_id IS NOT NULL THEN
    v_caller_id := p_verifier_id;
  END IF;

  IF NOT public.check_is_staff(v_caller_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Unauthorized: Only event members or admins can verify attendees.');
  END IF;

  -- Get verifier email
  SELECT email INTO v_verifier_email FROM public.profiles WHERE id = v_caller_id;
  IF v_verifier_email IS NULL THEN
    SELECT email INTO v_verifier_email FROM auth.users WHERE id = v_caller_id;
  END IF;

  -- Update attendee profile
  UPDATE public.profiles
  SET 
    entry_verified = TRUE,
    verified_at = NOW(),
    verified_by = COALESCE(v_verifier_email, 'Event Staff'),
    updated_at = NOW()
  WHERE id = p_attendee_id
  RETURNING email, display_name INTO v_attendee_email, v_attendee_name;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Attendee record not found.');
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'attendeeId', p_attendee_id,
    'attendeeName', v_attendee_name,
    'attendeeEmail', v_attendee_email,
    'verifiedBy', v_verifier_email,
    'verifiedAt', NOW()
  );
END;
$$;

-- 9. Secure RPC: Unverify Attendee Entry (for undo)
CREATE OR REPLACE FUNCTION public.unverify_attendee_entry(
  p_attendee_id UUID,
  p_verifier_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NULL AND p_verifier_id IS NOT NULL THEN
    v_caller_id := p_verifier_id;
  END IF;

  IF NOT public.check_is_staff(v_caller_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Unauthorized: Only event members or admins can unverify attendees.');
  END IF;

  UPDATE public.profiles
  SET 
    entry_verified = FALSE,
    verified_at = NULL,
    verified_by = NULL,
    updated_at = NOW()
  WHERE id = p_attendee_id;

  RETURN jsonb_build_object('success', TRUE, 'attendeeId', p_attendee_id);
END;
$$;

-- 10. Enable Staff to Read All Profiles for the Verification Desk Roster
DROP POLICY IF EXISTS "Staff can read all profiles" ON public.profiles;
CREATE POLICY "Staff can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.check_is_staff(auth.uid()) OR auth.uid() = id
  );

-- 11. Protect Investment Processing: Require entry_verified OR admin role
-- Ensure columns exist on investments table
ALTER TABLE public.investments 
  ADD COLUMN IF NOT EXISTS free_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_elapsed_ms INTEGER DEFAULT 0;

-- Must DROP previous function signature because return type changed from UUID (in 002_functions) to JSONB
DROP FUNCTION IF EXISTS public.process_investment(UUID, UUID, UUID, UUID, INTEGER, UUID);
DROP FUNCTION IF EXISTS public.process_investment(UUID, UUID, UUID, UUID, INT, UUID);
DROP FUNCTION IF EXISTS public.process_investment;

CREATE OR REPLACE FUNCTION public.process_investment(
  p_user_id    UUID,
  p_event_id   UUID,
  p_team_id    UUID,
  p_round_id   UUID,
  p_amount     INT,
  p_wallet_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_wallet            RECORD;
  v_round             RECORD;
  v_team              RECORD;
  v_config            RECORD;
  v_free_deduct       INT := 0;
  v_paid_deduct       INT := 0;
  v_remaining         INT;
  v_new_free          INT;
  v_new_paid          INT;
  v_new_invested      INT;
  v_investment_id     UUID;
  v_existing_invested INT := 0;
  v_time_elapsed_ms   INT := 0;
  v_open_time_ms      BIGINT;
  v_now_ms            BIGINT;
  v_profile           RECORD;
BEGIN
  -- Strict Check: User must be verified at the gate OR an admin
  SELECT role, entry_verified INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'User profile not found.');
  END IF;

  IF v_profile.role != 'admin' AND NOT COALESCE(v_profile.entry_verified, FALSE) THEN
    RETURN jsonb_build_object(
      'success', FALSE, 
      'error', 'Account verification required. Please show your Entry Pass QR to an event volunteer at the entrance gate before you can invest.'
    );
  END IF;

  -- 1. Validate round is open for investments
  SELECT * INTO v_round FROM public.pitch_rounds WHERE id = p_round_id;
  IF NOT FOUND OR v_round.status != 'investment_open' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Investment window is not open.');
  END IF;

  IF v_round.investment_close_time IS NOT NULL AND v_round.investment_close_time < NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Investment window deadline has passed.');
  END IF;

  -- Authoritatively calculate millisecond reaction time from window open
  IF v_round.investment_open_time IS NOT NULL THEN
    v_open_time_ms := (EXTRACT(EPOCH FROM v_round.investment_open_time) * 1000)::BIGINT;
    v_now_ms := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
    v_time_elapsed_ms := GREATEST(1, (v_now_ms - v_open_time_ms)::INT);
  END IF;

  -- 2. Fetch event config limits
  SELECT * INTO v_config FROM public.event_config WHERE event_id = p_event_id;
  IF FOUND THEN
    IF p_amount < v_config.min_investment_amount THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Minimum investment is ' || v_config.min_investment_amount || ' points.');
    END IF;
    IF p_amount > v_config.max_investment_amount THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Maximum investment per pitch is ' || v_config.max_investment_amount || ' points.');
    END IF;
  END IF;

  -- 3. Lock and validate user wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE id = p_wallet_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Wallet not found.');
  END IF;

  IF (v_wallet.free_points + v_wallet.purchased_points) < p_amount THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Insufficient points in wallet.');
  END IF;

  -- Deduct free points first, then purchased
  v_remaining := p_amount;
  IF v_wallet.free_points >= v_remaining THEN
    v_free_deduct := v_remaining;
    v_remaining   := 0;
  ELSE
    v_free_deduct := v_wallet.free_points;
    v_remaining   := v_remaining - v_wallet.free_points;
  END IF;

  IF v_remaining > 0 THEN
    v_paid_deduct := v_remaining;
  END IF;

  v_new_free     := v_wallet.free_points - v_free_deduct;
  v_new_paid     := v_wallet.purchased_points - v_paid_deduct;
  v_new_invested := v_wallet.invested_points + p_amount;

  -- Update wallet
  UPDATE public.wallets
  SET free_points      = v_new_free,
      purchased_points = v_new_paid,
      invested_points  = v_new_invested,
      updated_at       = NOW()
  WHERE id = p_wallet_id;

  -- Insert investment record
  INSERT INTO public.investments (
    user_id, event_id, team_id, round_id, amount, free_amount, paid_amount, time_elapsed_ms, created_at
  ) VALUES (
    p_user_id, p_event_id, p_team_id, p_round_id, p_amount, v_free_deduct, v_paid_deduct, v_time_elapsed_ms, NOW()
  ) RETURNING id INTO v_investment_id;

  -- Insert ledger entry
  SELECT name INTO v_team FROM public.teams WHERE id = p_team_id;
  INSERT INTO public.wallet_ledger (
    wallet_id, user_id, type, amount, balance_after, description, reference_id, created_at
  ) VALUES (
    p_wallet_id, p_user_id, 'investment', -p_amount, (v_new_free + v_new_paid),
    'Backed ' || COALESCE(v_team.name, 'Startup') || ' with ' || p_amount || ' points',
    v_investment_id::TEXT, NOW()
  );

  -- Update startup stats
  SELECT COALESCE(SUM(amount), 0) INTO v_existing_invested FROM public.investments WHERE team_id = p_team_id;
  UPDATE public.teams
  SET total_investment = v_existing_invested,
      unique_backers   = (SELECT COUNT(DISTINCT user_id) FROM public.investments WHERE team_id = p_team_id),
      updated_at       = NOW()
  WHERE id = p_team_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'investmentId', v_investment_id,
    'timeElapsedMs', v_time_elapsed_ms,
    'newBalance', (v_new_free + v_new_paid)
  );
END;
$$;
