-- Fiabilise la création du profil à l'onboarding (setup / inscription).
-- Contourne les échecs RLS ou contrainte UNIQUE sur profiles.phone.

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.ensure_my_profile(p_phone text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_phone text := NULLIF(trim(p_phone), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.profiles (id, phone)
  VALUES (v_uid, v_phone)
  ON CONFLICT (id) DO NOTHING;

  IF v_phone IS NOT NULL THEN
    BEGIN
      UPDATE public.profiles
      SET phone = v_phone, updated_at = NOW()
      WHERE id = v_uid AND (phone IS DISTINCT FROM v_phone);
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile(text) TO authenticated;
