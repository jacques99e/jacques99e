-- Recréer les buckets storage si absents (ex. après purge ou projet neuf)
INSERT INTO storage.buckets (id, name, public) VALUES
  ('product-images', 'product-images', true),
  ('health-docs', 'health-docs', false),
  ('course-media', 'course-media', true),
  ('certificates', 'certificates', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Politiques product-images (idempotent)
DROP POLICY IF EXISTS "Authenticated upload images" ON storage.objects;
DROP POLICY IF EXISTS "Public read images" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete images" ON storage.objects;
DROP POLICY IF EXISTS "Owners update images" ON storage.objects;
DROP POLICY IF EXISTS "Service role product images" ON storage.objects;

CREATE POLICY "Authenticated upload images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');
CREATE POLICY "Public read images" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');
CREATE POLICY "Owners delete images" ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners update images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "auth_upload_health" ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_course" ON storage.objects;
DROP POLICY IF EXISTS "public_read_course_media" ON storage.objects;

CREATE POLICY "auth_upload_health" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'health-docs' AND auth.role() = 'authenticated');
CREATE POLICY "auth_upload_course" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('course-media', 'certificates') AND auth.role() = 'authenticated');

CREATE POLICY "public_read_course_media" ON storage.objects FOR SELECT
  USING (bucket_id IN ('product-images', 'course-media', 'certificates'));
