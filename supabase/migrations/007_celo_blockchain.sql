-- Ancrage Celo pour le module traçabilité
ALTER TABLE blockchain_assets
  ADD COLUMN IF NOT EXISTS celo_tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS celo_network TEXT,
  ADD COLUMN IF NOT EXISTS celo_block_number BIGINT,
  ADD COLUMN IF NOT EXISTS celo_anchored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_blockchain_assets_celo_tx ON blockchain_assets (celo_tx_hash)
  WHERE celo_tx_hash IS NOT NULL;
