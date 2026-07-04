-- Limite bucket course-media (50 Mo = max plan Free Supabase).
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'course-media';
