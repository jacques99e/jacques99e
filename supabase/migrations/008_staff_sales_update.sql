-- Allow staff upsert/update on sales (migration 007 added INSERT only)
DROP POLICY IF EXISTS "staff_update_sales" ON public.sales;
CREATE POLICY "staff_update_sales" ON public.sales
FOR UPDATE
USING (public.can_access_store(store_id))
WITH CHECK (public.can_access_store(store_id));

DROP POLICY IF EXISTS "staff_delete_sale_items" ON public.sale_items;
CREATE POLICY "staff_delete_sale_items" ON public.sale_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id AND public.can_access_store(s.store_id)
  )
);
