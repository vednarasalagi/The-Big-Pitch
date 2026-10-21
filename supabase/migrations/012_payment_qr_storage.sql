-- ============================================================
-- The Big Pitch — Payment QR Code Storage Bucket & Policies
-- Migration: 012_payment_qr_storage.sql
-- ============================================================

-- 1. Create storage bucket for payment QR codes if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-qr-codes',
  'payment-qr-codes',
  true,
  5242880, -- 5 MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

-- 2. Storage Policies

-- Anyone (public audience) can view/download payment QR code images
DROP POLICY IF EXISTS "Public can view payment QR codes" ON storage.objects;
CREATE POLICY "Public can view payment QR codes"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-qr-codes');

-- Admins can upload QR code images
DROP POLICY IF EXISTS "Admins can upload payment QR codes" ON storage.objects;
CREATE POLICY "Admins can upload payment QR codes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-qr-codes'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  )
);

-- Admins can update/overwrite QR code images
DROP POLICY IF EXISTS "Admins can update payment QR codes" ON storage.objects;
CREATE POLICY "Admins can update payment QR codes"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-qr-codes'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  )
);

-- Admins can delete QR code images
DROP POLICY IF EXISTS "Admins can delete payment QR codes" ON storage.objects;
CREATE POLICY "Admins can delete payment QR codes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-qr-codes'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  )
);
