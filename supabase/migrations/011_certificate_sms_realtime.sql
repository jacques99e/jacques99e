-- Certificat vérifiable (QR), suivi SMS, temps réel formateur

ALTER TABLE course_enrollments
  ADD COLUMN IF NOT EXISTS certificate_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_sms_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_course_enrollments_certificate_token
  ON course_enrollments(certificate_token);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_progress
  ON course_enrollments(course_id, progress_percent DESC);

-- Temps réel Supabase pour le tableau de bord formateur
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'course_enrollments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE course_enrollments;
  END IF;
END $$;
