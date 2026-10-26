-- ============================================================
-- The Big Pitch — Celebration Audio Storage Bucket & Policies
-- Migration: 021_celebration_audio_storage.sql
-- ============================================================

-- 1. Create dedicated storage bucket for celebration audio tracks (up to 50 MB)
-- Setting allowed_mime_types to NULL allows all audio types (mp3, wav, m4a, ogg, aac, etc.)
-- without failing due to browser-specific MIME type differences.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'celebration-audio',
  'celebration-audio',
  true,
  52428800, -- 50 MB limit
  NULL      -- Allow all MIME types (bypasses strict server-side MIME string rejection)
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = NULL;

-- 2. Also ensure 'avatars' bucket can receive audio as a fallback
UPDATE storage.buckets
SET file_size_limit = 52428800,
    allowed_mime_types = NULL
WHERE id = 'avatars';

-- 3. Storage Policies for 'celebration-audio' bucket

-- Anyone (public, projector screen, admin, audience) can stream/play celebration audio
DROP POLICY IF EXISTS "Public can view celebration audio" ON storage.objects;
CREATE POLICY "Public can view celebration audio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'celebration-audio');

-- Admins and users can upload celebration audio
DROP POLICY IF EXISTS "Authenticated users and admins can upload celebration audio" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload celebration audio" ON storage.objects;
CREATE POLICY "Anyone can upload celebration audio"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'celebration-audio'
);

-- Admins and users can update/replace celebration audio (needed for upsert: true)
DROP POLICY IF EXISTS "Authenticated users and admins can update celebration audio" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update celebration audio" ON storage.objects;
CREATE POLICY "Anyone can update celebration audio"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'celebration-audio')
WITH CHECK (
  bucket_id = 'celebration-audio'
);

-- Admins and users can delete celebration audio
DROP POLICY IF EXISTS "Authenticated users and admins can delete celebration audio" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete celebration audio" ON storage.objects;
CREATE POLICY "Anyone can delete celebration audio"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'celebration-audio');

