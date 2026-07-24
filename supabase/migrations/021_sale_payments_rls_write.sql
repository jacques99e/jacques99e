-- Allow authenticated store staff to insert/update sale_payments
-- (API currently uses user-scoped Supabase client, not always service role)

DROP POLICY IF EXISTS sale_payments_insert_own ON public.sale_payments;
CREATE POLICY sale_payments_insert_own ON public.sale_payments
  FOR INSERT
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND (
      store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
      OR store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND role IS DISTINCT FROM 'accountant'
      )
    )
  );

DROP POLICY IF EXISTS sale_payments_update_own ON public.sale_payments;
CREATE POLICY sale_payments_update_own ON public.sale_payments
  FOR UPDATE
  USING (
    store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
    OR store_id IN (
      SELECT store_id FROM public.store_members
      WHERE user_id = auth.uid() AND role IS DISTINCT FROM 'accountant'
    )
    OR user_id = auth.uid()
  )
  WITH CHECK (
    store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
    OR store_id IN (
      SELECT store_id FROM public.store_members
      WHERE user_id = auth.uid() AND role IS DISTINCT FROM 'accountant'
    )
    OR user_id = auth.uid()
  );
