-- La séquence de relance J+1 / J+3 suit le client sur le compte.

ALTER TABLE public.crm_clients
  ADD COLUMN IF NOT EXISTS sequence_step smallint,
  ADD COLUMN IF NOT EXISTS sequence_started_at date,
  ADD COLUMN IF NOT EXISTS last_relance_at date;

ALTER TABLE public.crm_clients
  DROP CONSTRAINT IF EXISTS crm_clients_sequence_step_check;

ALTER TABLE public.crm_clients
  ADD CONSTRAINT crm_clients_sequence_step_check
  CHECK (sequence_step IS NULL OR sequence_step IN (1, 2));
