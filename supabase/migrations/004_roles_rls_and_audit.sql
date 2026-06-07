-- Wazo Digital - Phase 4 production hardening
-- Roles + store membership + audit trail + RLS helpers.
-- Idempotent migration.

-- 1) Team membership per store (owner + staff)
CREATE TABLE IF NOT EXISTS public.store_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, user_id));

CREATE INDEX IF NOT EXISTS idx_store_members_store ON public.store_members(store_id);
CREATE INDEX IF NOT EXISTS idx_store_members_user ON public.store_members(user_id);

ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_members_select_own_store" ON public.store_members;
CREATE POLICY "store_members_select_own_store"
ON public.store_members
FOR SELECT
USING (
  user_id = auth.uid()
  OR store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
);

DROP POLICY IF EXISTS "store_members_owner_manage" ON public.store_members;
CREATE POLICY "store_members_owner_manage"
ON public.store_members
FOR ALL
USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()))
WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

-- 2) Helper functions for access checks
CREATE OR REPLACE FUNCTION public.can_access_store(target_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = target_store_id
      AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.store_members m
          WHERE m.store_id = s.id
            AND m.user_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_store(target_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = target_store_id
      AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.store_members m
          WHERE m.store_id = s.id
            AND m.user_id = auth.uid()
            AND m.role = 'manager'
        )
      )
  );
$$;

-- 3) Add optional read policies for staff on key tables
-- Owner policies already exist; these are additive.
DO $$
BEGIN
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "staff_read_products" ON public.products';
    EXECUTE 'CREATE POLICY "staff_read_products" ON public.products FOR SELECT USING (public.can_access_store(store_id))';
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "staff_read_sales" ON public.sales';
    EXECUTE 'CREATE POLICY "staff_read_sales" ON public.sales FOR SELECT USING (public.can_access_store(store_id))';
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "staff_read_deliveries" ON public.deliveries';
    EXECUTE 'CREATE POLICY "staff_read_deliveries" ON public.deliveries FOR SELECT USING (public.can_access_store(store_id))';
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "staff_read_health_patients" ON public.health_patients';
    EXECUTE 'CREATE POLICY "staff_read_health_patients" ON public.health_patients FOR SELECT USING (public.can_access_store(store_id))';
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "staff_read_courses" ON public.courses';
    EXECUTE 'CREATE POLICY "staff_read_courses" ON public.courses FOR SELECT USING (public.can_access_store(store_id))';
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
END;
$$;

-- 4) Audit log table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_store_created ON public.audit_logs(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON public.audit_logs(user_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert"
ON public.audit_logs
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR user_id IS NULL
);

DROP POLICY IF EXISTS "audit_logs_select_store_access" ON public.audit_logs;
CREATE POLICY "audit_logs_select_store_access"
ON public.audit_logs
FOR SELECT
USING (
  (store_id IS NOT NULL AND public.can_access_store(store_id))
  OR user_id = auth.uid()
);
