-- Wazo Digital - Billing subscriptions and payment tracking
-- Adds persistent subscription state per store + payment ledger.
-- Idempotent migration.

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'business')),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'expired')),
  trial_start DATE NOT NULL DEFAULT CURRENT_DATE,
  trial_days INTEGER NOT NULL DEFAULT 14 CHECK (trial_days > 0 AND trial_days <= 90),
  current_period_end DATE,
  last_payment_at TIMESTAMPTZ,
  provider TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_store ON public.billing_subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON public.billing_subscriptions(status);

CREATE TABLE IF NOT EXISTS public.billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'pro', 'business')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'XOF',
  method TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_tx_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_store_created ON public.billing_payments(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_payments_tx ON public.billing_payments(provider_tx_id);

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_subscriptions_select_store_access" ON public.billing_subscriptions;
CREATE POLICY "billing_subscriptions_select_store_access"
ON public.billing_subscriptions
FOR SELECT
USING (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  OR store_id IN (SELECT store_id FROM public.store_members WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "billing_subscriptions_manage_store" ON public.billing_subscriptions;
CREATE POLICY "billing_subscriptions_manage_store"
ON public.billing_subscriptions
FOR ALL
USING (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  OR store_id IN (
    SELECT store_id FROM public.store_members
    WHERE user_id = auth.uid() AND role = 'manager'
  )
)
WITH CHECK (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  OR store_id IN (
    SELECT store_id FROM public.store_members
    WHERE user_id = auth.uid() AND role = 'manager'
  )
);

DROP POLICY IF EXISTS "billing_payments_select_store_access" ON public.billing_payments;
CREATE POLICY "billing_payments_select_store_access"
ON public.billing_payments
FOR SELECT
USING (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  OR store_id IN (SELECT store_id FROM public.store_members WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "billing_payments_insert_own_store" ON public.billing_payments;
CREATE POLICY "billing_payments_insert_own_store"
ON public.billing_payments
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (
    store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
    OR store_id IN (
      SELECT store_id FROM public.store_members
      WHERE user_id = auth.uid() AND role = 'manager'
    )
  )
);

DROP POLICY IF EXISTS "billing_payments_update_store_manage" ON public.billing_payments;
CREATE POLICY "billing_payments_update_store_manage"
ON public.billing_payments
FOR UPDATE
USING (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  OR store_id IN (
    SELECT store_id FROM public.store_members
    WHERE user_id = auth.uid() AND role = 'manager'
  )
)
WITH CHECK (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  OR store_id IN (
    SELECT store_id FROM public.store_members
    WHERE user_id = auth.uid() AND role = 'manager'
  )
);

