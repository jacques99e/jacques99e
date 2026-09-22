-- Les écritures d'argent passent par le serveur (service role).
-- Le navigateur peut lire, pas changer un plan ni marquer un paiement réussi.

DROP POLICY IF EXISTS "billing_subscriptions_manage_store" ON public.billing_subscriptions;
DROP POLICY IF EXISTS "billing_payments_insert_own_store" ON public.billing_payments;
DROP POLICY IF EXISTS "billing_payments_update_store_manage" ON public.billing_payments;

DROP POLICY IF EXISTS sale_payments_insert_own ON public.sale_payments;
DROP POLICY IF EXISTS sale_payments_update_own ON public.sale_payments;

-- Les commandes COD passent par /api/boutique/orders (service role).
DROP POLICY IF EXISTS "public_insert_product_orders" ON public.product_orders;

-- Uploads directs : seulement ses propres vidéos de cours.
-- Images, dossiers santé et certificats passent par /api/media/upload.
DROP POLICY IF EXISTS "Authenticated upload images" ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_health" ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_course" ON storage.objects;

DROP POLICY IF EXISTS "auth_upload_course_own" ON storage.objects;
CREATE POLICY "auth_upload_course_own" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'course-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Le rôle de profil ne se change pas depuis le navigateur.
CREATE OR REPLACE FUNCTION public.profiles_lock_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_lock_role ON public.profiles;
CREATE TRIGGER profiles_lock_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_lock_role();
