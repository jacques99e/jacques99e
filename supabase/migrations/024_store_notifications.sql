-- In-app evolution inbox (emails go through Resend; this table is the source of truth).

CREATE TABLE IF NOT EXISTS public.store_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'progress'
    CHECK (kind IN ('weekly', 'milestone', 'progress', 'alert')),
  dedup_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  href TEXT,
  read_at TIMESTAMPTZ,
  emailed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_notifications_dedup
  ON public.store_notifications(store_id, dedup_key);

CREATE INDEX IF NOT EXISTS idx_store_notifications_store_created
  ON public.store_notifications(store_id, created_at DESC);

ALTER TABLE public.store_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_notifications_access" ON public.store_notifications;
CREATE POLICY "store_notifications_access" ON public.store_notifications
  FOR ALL
  USING (can_access_store(store_id))
  WITH CHECK (can_access_store(store_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_notifications TO authenticated;
GRANT ALL ON public.store_notifications TO service_role;
