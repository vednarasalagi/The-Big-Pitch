-- ============================================================
-- 006_fix_test_user_and_auth.sql
-- Fix test@gmail.com by converting the valid GoTrue record
-- or creating with all required non-null GoTrue fields.
-- ============================================================

DO $$
DECLARE
  v_source_id UUID;
  v_test_id UUID := gen_random_uuid();
  v_identity_id UUID := gen_random_uuid();
BEGIN
  -- 1. Remove the old broken test@gmail.com records completely
  SELECT id INTO v_test_id FROM auth.users WHERE LOWER(email) = 'test@gmail.com';
  IF v_test_id IS NOT NULL THEN
    DELETE FROM auth.identities WHERE user_id = v_test_id;
    DELETE FROM public.wallets WHERE user_id = v_test_id;
    DELETE FROM public.profiles WHERE id = v_test_id;
    DELETE FROM auth.users WHERE id = v_test_id;
  END IF;

  -- 2. Check if the GoTrue-generated user exists to convert directly
  SELECT id INTO v_source_id FROM auth.users WHERE LOWER(email) = 'alexsmithdev2024@gmail.com';

  IF v_source_id IS NOT NULL THEN
    -- Convert the valid GoTrue record into test@gmail.com
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
    WHERE id = v_source_id;

    -- Update the identity to test@gmail.com
    UPDATE auth.identities
    SET
      identity_data = jsonb_build_object(
        'email', 'test@gmail.com',
        'email_verified', true,
        'phone_verified', false,
        'sub', v_source_id::text
      ),
      last_sign_in_at = NOW(),
      updated_at = NOW()
    WHERE user_id = v_source_id;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'email'
      AND is_generated = 'NEVER'
    ) THEN
      EXECUTE 'UPDATE auth.identities SET email = ''test@gmail.com'' WHERE user_id = $1' USING v_source_id;
    END IF;

    v_test_id := v_source_id;
  ELSE
    -- Fallback: Insert with every non-null column explicitly populated
    v_test_id := gen_random_uuid();

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
      v_test_id,
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
        $1, $2, jsonb_build_object(''email'', ''test@gmail.com'', ''email_verified'', true, ''sub'', $2::text),
        ''email'', $2::text, NOW(), NOW(), NOW()
      )' USING v_identity_id, v_test_id;
    ELSE
      EXECUTE 'INSERT INTO auth.identities (
        id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        $1, $2, jsonb_build_object(''email'', ''test@gmail.com'', ''email_verified'', true, ''sub'', $2::text),
        ''email'', NOW(), NOW(), NOW()
      )' USING v_identity_id, v_test_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'email'
      AND is_generated = 'NEVER'
    ) THEN
      EXECUTE 'UPDATE auth.identities SET email = ''test@gmail.com'' WHERE user_id = $1' USING v_test_id;
    END IF;
  END IF;

  -- 3. Ensure public profile is created and verified
  INSERT INTO public.profiles (id, email, display_name, role, is_verified)
  VALUES (v_test_id, 'test@gmail.com', 'Test User', 'audience', TRUE)
  ON CONFLICT (id) DO UPDATE SET
    email = 'test@gmail.com',
    display_name = 'Test User',
    is_verified = TRUE,
    updated_at = NOW();

  -- 4. Ensure wallet exists with 500 audience points
  INSERT INTO public.wallets (user_id, event_id, free_points, free_points_granted)
  VALUES (v_test_id, '11111111-0000-0000-0000-000000000001', 500, TRUE)
  ON CONFLICT (user_id, event_id) DO UPDATE SET
    free_points = GREATEST(wallets.free_points, 500);

END $$;
