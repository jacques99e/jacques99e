-- Évite les doublons d'apprenants pour un même cours (nom normalisé).
ALTER TABLE course_enrollments
  ADD COLUMN IF NOT EXISTS student_name_normalized TEXT;

UPDATE course_enrollments
SET student_name_normalized = lower(trim(regexp_replace(student_name, '\s+', ' ', 'g')))
WHERE student_name_normalized IS NULL;

-- Conserver l'inscription la plus ancienne par cours + nom.
DELETE FROM course_enrollments a
USING course_enrollments b
WHERE a.course_id = b.course_id
  AND a.student_name_normalized IS NOT NULL
  AND b.student_name_normalized IS NOT NULL
  AND a.student_name_normalized = b.student_name_normalized
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_course_enrollments_unique_name
  ON course_enrollments (course_id, student_name_normalized)
  WHERE student_name_normalized IS NOT NULL;
