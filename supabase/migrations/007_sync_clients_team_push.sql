-- Wazo Digital - Cloud sync (CRM clients, sales), team roles, push, weekly email
-- Run in Supabase SQL Editor if not applied via CLI.

-- 1) CRM clients
CREATE TABLE IF NOT EXISTS public.crm_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  external_local_id TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'prospect'
    CHECK (status IN ('prospect', 'active', 'relance')),
  next_follow_up DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_clients_store_external
  ON public.crm_clients(store_id, external_local_id)
  WHERE external_local_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_clients_store ON public.crm_clients(store_id);

-- 2) Sales columns (align app with DB)
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'completed';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS external_local_id TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS crm_client_id UUID REFERENCES public.crm_clients(id) ON DELETE SET NULL;

UPDATE public.sales SET total_amount = total WHERE total_amount IS NULL AND total IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_store_external
  ON public.sales(store_id, external_local_id)
  WHERE external_local_id IS NOT NULL;

-- 3) Sale items flexibility (local / offline products)
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2);

DO $$
BEGIN
  ALTER TABLE public.sale_items ALTER COLUMN product_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- 4) Extend team roles
ALTER TABLE public.store_members DROP CONSTRAINT IF EXISTS store_members_role_check;
ALTER TABLE public.store_members
  ADD CONSTRAINT store_members_role_check
  CHECK (role IN ('employee', 'manager', 'accountant'));

-- 5) Weekly report email per store
CREATE TABLE IF NOT EXISTS public.store_report_settings (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  weekday SMALLINT NOT NULL DEFAULT 1 CHECK (weekday BETWEEN 0 AND 6),
  hour_utc SMALLINT NOT NULL DEFAULT 8 CHECK (hour_utc BETWEEN 0 AND 23),
  last_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6) Web push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_store ON public.push_subscriptions(store_id);

-- 7) RLS
ALTER TABLE public.crm_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_clients_access" ON public.crm_clients;
CREATE POLICY "crm_clients_access" ON public.crm_clients
FOR ALL
USING (public.can_access_store(store_id))
WITH CHECK (public.can_access_store(store_id));

DROP POLICY IF EXISTS "store_report_owner_manage" ON public.store_report_settings;
CREATE POLICY "store_report_owner_manage" ON public.store_report_settings
FOR ALL
USING (public.can_manage_store(store_id))
WITH CHECK (public.can_manage_store(store_id));

DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Staff write sales (owners already have FOR ALL)
DROP POLICY IF EXISTS "staff_insert_sales" ON public.sales;
CREATE POLICY "staff_insert_sales" ON public.sales
FOR INSERT
WITH CHECK (public.can_access_store(store_id));

DROP POLICY IF EXISTS "staff_read_sale_items" ON public.sale_items;
CREATE POLICY "staff_read_sale_items" ON public.sale_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id AND public.can_access_store(s.store_id)
  )
);

DROP POLICY IF EXISTS "staff_insert_sale_items" ON public.sale_items;
CREATE POLICY "staff_insert_sale_items" ON public.sale_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id AND public.can_access_store(s.store_id)
  )
);

-- Helper: staff can write sales (not accountant-only)
CREATE OR REPLACE FUNCTION public.can_write_store_data(target_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = target_store_id AND s.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.store_members m
    WHERE m.store_id = target_store_id
      AND m.user_id = auth.uid()
      AND m.role IN ('employee', 'manager')
  );
$$;
