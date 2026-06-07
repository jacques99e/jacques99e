-- Supabase security linter fixes (0011 search_path, 0028/0029 RPC exposure)
-- Run in Supabase SQL Editor after migrations 007-008.

-- 1) user_store_ids: fixed search_path + staff stores included
CREATE OR REPLACE FUNCTION public.user_store_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.stores s
  WHERE s.owner_id = auth.uid()
  UNION
  SELECT m.store_id
  FROM public.store_members m
  WHERE m.user_id = auth.uid();
$$;

-- 2) Ensure can_write_store_data has immutable search_path (from 007)
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

-- 3) handle_new_user (trigger only — not callable via PostgREST RPC)
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

-- 4) Block direct RPC access; functions remain usable inside RLS policies
REVOKE ALL ON FUNCTION public.can_access_store(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_store(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_access_store(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.can_manage_store(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_store(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_manage_store(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.can_write_store_data(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_write_store_data(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_write_store_data(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE ALL ON FUNCTION public.user_store_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_store_ids() FROM anon;
REVOKE ALL ON FUNCTION public.user_store_ids() FROM authenticated;

-- Optional Supabase-managed helper (if present on project)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM authenticated';
  END IF;
END $$;
