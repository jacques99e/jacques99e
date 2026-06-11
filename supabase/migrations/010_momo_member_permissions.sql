-- Permission granulaire : employés peuvent créer des liens MoMo (toggle par le propriétaire)
ALTER TABLE public.store_members
  ADD COLUMN IF NOT EXISTS allow_momo_links BOOLEAN NOT NULL DEFAULT true;
