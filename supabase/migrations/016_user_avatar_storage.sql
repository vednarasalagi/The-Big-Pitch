-- ============================================================
-- The Big Pitch — User Avatar Storage Bucket & Profile Policies
-- Migration: 016_user_avatar_storage.sql
-- ============================================================

-- 1. Create storage bucket for attendee avatars if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

-- 2. Storage Policies

-- Anyone (public, projector screen, other users) can view avatars
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Users can upload avatars (both authenticated users and new signups)
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (
  bucket_id = 'avatars'
);

-- Authenticated users can update avatars
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
CREATE POLICY "Authenticated users can update avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- Authenticated users can delete avatars
DROP POLICY IF EXISTS "Authenticated users can delete avatars" ON storage.objects;
CREATE POLICY "Authenticated users can delete avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- 3. Profiles Table Permissions
-- Ensure authenticated users can update their own profile display name & avatar_url
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 4. Atomic RPC to update profile & avatar with server-side validation
DROP FUNCTION IF EXISTS public.update_user_profile(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_user_profile(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.update_user_profile;

CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_display_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_clean_name TEXT;
  v_res JSONB;
BEGIN
  v_user_id := COALESCE(auth.uid(), p_user_id);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Unauthorized: No active session');
  END IF;

  v_clean_name := NULLIF(TRIM(COALESCE(p_display_name, '')), '');

  UPDATE public.profiles
  SET
    display_name = COALESCE(v_clean_name, display_name),
    avatar_url   = COALESCE(p_avatar_url, avatar_url),
    updated_at   = NOW()
  WHERE id = v_user_id;

  SELECT jsonb_build_object(
    'success', TRUE,
    'id', p.id,
    'displayName', p.display_name,
    'email', p.email,
    'avatarUrl', p.avatar_url
  )
  INTO v_res
  FROM public.profiles p
  WHERE p.id = v_user_id;

  RETURN COALESCE(v_res, jsonb_build_object('success', TRUE));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_profile(TEXT, TEXT, UUID) TO authenticated, anon;
