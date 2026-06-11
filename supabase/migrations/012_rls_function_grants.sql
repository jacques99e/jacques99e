-- Restaure EXECUTE pour authenticated : requis pour que les politiques RLS
-- appellent user_store_ids(), can_manage_store(), etc. (migration 009 avait tout révoqué).
-- Les fonctions restent non exposées en RPC PostgREST tant qu'elles ne sont pas dans la liste API.

GRANT EXECUTE ON FUNCTION public.user_store_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_store(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_store_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_store(uuid) TO authenticated;
