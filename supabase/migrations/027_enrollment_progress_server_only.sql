-- La progression, le certificat et le jeton d'inscription
-- ne se changent plus depuis le navigateur.

CREATE OR REPLACE FUNCTION public.enrollment_lock_progress()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.progress_percent := OLD.progress_percent;
    NEW.progress_meta := OLD.progress_meta;
    NEW.completed_at := OLD.completed_at;
    NEW.certificate_token := OLD.certificate_token;
    NEW.access_token := OLD.access_token;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enrollment_lock_progress ON public.course_enrollments;
CREATE TRIGGER enrollment_lock_progress
  BEFORE UPDATE ON public.course_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.enrollment_lock_progress();
