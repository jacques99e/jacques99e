-- Fix sales cloud sync: partial unique index breaks PostgREST upsert (onConflict).
-- App uses select-then-insert/update; this constraint also enables native upsert.

DROP INDEX IF EXISTS public.idx_sales_store_external;

ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_store_external_local_id_key;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_store_external_local_id_key
  UNIQUE (store_id, external_local_id);

-- RLS: ensure INSERT has explicit WITH CHECK for owners
DROP POLICY IF EXISTS "Store owners manage sales" ON public.sales;
CREATE POLICY "Store owners manage sales" ON public.sales
  FOR ALL
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

-- Migration 009 revoked EXECUTE but RLS policies still call these helpers.
GRANT EXECUTE ON FUNCTION public.can_access_store(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_store_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_store(uuid) TO authenticated;
