-- Quiz par leçon, sous-titres multilingues, progression détaillée

ALTER TABLE course_modules
  ADD COLUMN IF NOT EXISTS subtitles JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE course_quizzes
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES course_modules(id) ON DELETE CASCADE;

ALTER TABLE course_enrollments
  ADD COLUMN IF NOT EXISTS progress_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_course_quizzes_module ON course_quizzes(module_id);
