-- Merchant Facebook/Instagram connections for social publishing
CREATE TABLE IF NOT EXISTS public.store_social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'facebook'
    CHECK (platform IN ('facebook', 'instagram')),
  page_id TEXT NOT NULL,
  page_name TEXT,
  page_access_token TEXT NOT NULL,
  ig_user_id TEXT,
  ig_username TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_store_social_accounts_store
  ON public.store_social_accounts(store_id);

ALTER TABLE public.store_social_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_social_accounts_owner_select ON public.store_social_accounts;
CREATE POLICY store_social_accounts_owner_select
  ON public.store_social_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.owner_id = auth.uid()
    )
  );

COMMENT ON TABLE public.store_social_accounts IS
  'Facebook Page / Instagram tokens per store; writes via service role API only.';
