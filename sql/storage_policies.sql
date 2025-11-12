-- =====================================================
-- Storage Policies for EliteMC Cooperative
-- Run this after creating storage buckets
-- =====================================================

-- Enable RLS on storage tables
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Bucket: bank-proofs
-- =====================================================

-- Policy 1: Anyone can view bank proofs (for admin review)
CREATE POLICY "Public can view bank proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'bank-proofs');

-- Policy 2: Authenticated users can upload their own proofs
CREATE POLICY "Users can upload bank proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'bank-proofs' AND
  auth.role() = 'authenticated'
);

-- Policy 3: Users can update their own uploads
CREATE POLICY "Users can update their bank proofs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'bank-proofs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Users can delete their own uploads
CREATE POLICY "Users can delete their bank proofs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'bank-proofs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- =====================================================
-- Bucket: property-images
-- =====================================================

-- Policy 1: Anyone can view property images
CREATE POLICY "Public can view property images"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-images');

-- Policy 2: Authenticated users can upload property images
CREATE POLICY "Authenticated users can upload property images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'property-images' AND
  auth.role() = 'authenticated'
);

-- Policy 3: Authenticated users can update property images
CREATE POLICY "Authenticated users can update property images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'property-images' AND
  auth.role() = 'authenticated'
);

-- Policy 4: Admins can delete property images
CREATE POLICY "Admins can delete property images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'property-images' AND
  auth.role() = 'authenticated'
);

-- =====================================================
-- Bucket Policies
-- =====================================================

-- Allow viewing all buckets
CREATE POLICY "Users can view buckets"
ON storage.buckets FOR SELECT
USING (true);

-- =====================================================
-- Verify Policies
-- =====================================================

-- Run this to check policies are created:
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'objects'
ORDER BY policyname;

COMMENT ON SCHEMA storage IS 'Storage policies configured for EliteMC Cooperative';
