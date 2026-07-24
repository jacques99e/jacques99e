-- Restore EXECUTE on RLS helper functions for authenticated users.
-- Migration 009 revoked these; without GRANT, policies fail with:
-- permission denied for function can_access_store (42501)

GRANT EXECUTE ON FUNCTION public.can_access_store(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_store(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.can_manage_store(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_store(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.can_write_store_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_store_data(uuid) TO service_role;

-- Keep PUBLIC/anon locked down
REVOKE ALL ON FUNCTION public.can_access_store(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_store(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_manage_store(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_store(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_write_store_data(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_write_store_data(uuid) FROM anon;
