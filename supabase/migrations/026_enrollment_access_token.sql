-- Chaque apprenant public a un jeton. Le nom seul ne reprend plus le parcours d'un autre.

ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS access_token TEXT;

UPDATE public.course_enrollments
SET access_token = encode(gen_random_bytes(24), 'hex')
WHERE access_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_course_enrollments_access_token
  ON public.course_enrollments (access_token);

DROP INDEX IF EXISTS idx_course_enrollments_unique_name;
