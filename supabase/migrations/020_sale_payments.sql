-- Sale MoMo checkouts (PayDunya) — pending until callback succeeds
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'XOF',
  method TEXT NOT NULL DEFAULT 'momo',
  provider TEXT NOT NULL DEFAULT 'paydunya',
  provider_tx_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  sale_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_store_created
  ON public.sale_payments(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_payments_tx
  ON public.sale_payments(provider_tx_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_status
  ON public.sale_payments(status);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sale_payments_select_own ON public.sale_payments;
CREATE POLICY sale_payments_select_own ON public.sale_payments
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = sale_payments.store_id AND s.owner_id = auth.uid()
    )
  );

-- Writes go through service role (API), not anon/authenticated clients.
