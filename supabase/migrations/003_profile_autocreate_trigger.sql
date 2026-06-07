-- Wazo Digital - Auto-creation du profil a l'inscription
-- A executer dans le SQL Editor de Supabase. Idempotent et sans risque.
--
-- Contexte: stores.owner_id reference profiles(id). Sans profil, la creation
-- d'une boutique echoue avec "violates foreign key constraint stores_owner_id_fkey"
-- (code 23503). Ce trigger garantit qu'une ligne profiles existe pour chaque
-- utilisateur auth.
--
-- profiles.phone est UNIQUE: on le rend nullable et on insere NULL pour les
-- comptes sans telephone (email / anonyme), sinon deux chaines vides '' entrent
-- en collision sur la contrainte unique (profiles_phone_key).

-- 1. Rendre phone nullable et normaliser les valeurs vides existantes.
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
UPDATE public.profiles SET phone = NULL WHERE phone = '';

-- 2. Fonction robuste (NULL si pas de telephone, idempotente).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone)
  VALUES (NEW.id, NULLIF(NEW.phone, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill: cree un profil pour les utilisateurs auth existants qui n'en ont pas.
INSERT INTO public.profiles (id, phone)
SELECT u.id, NULLIF(u.phone, '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
