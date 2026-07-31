-- Fix store_modules persistence + backfill from profiles.active_modules
-- Ensures owners can insert/update rows, and existing stores get their chosen modules.

-- Explicit WITH CHECK so INSERT after store creation is allowed.
DROP POLICY IF EXISTS "owners_store_modules" ON store_modules;
CREATE POLICY "owners_store_modules" ON store_modules
  FOR ALL
  USING (store_id IN (SELECT user_store_ids()))
  WITH CHECK (store_id IN (SELECT user_store_ids()));

-- Backfill store_modules from profile intentions when a store has no enabled modules.
INSERT INTO store_modules (store_id, module_id, enabled)
SELECT
  s.id AS store_id,
  mod.module_id,
  true AS enabled
FROM stores s
JOIN profiles p ON p.id = s.owner_id
CROSS JOIN LATERAL (
  SELECT DISTINCT jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(COALESCE(p.active_modules, '[]'::jsonb)) = 'array'
        THEN COALESCE(p.active_modules, '[]'::jsonb)
      ELSE '["commerce"]'::jsonb
    END
  ) AS module_id
) mod
WHERE NOT EXISTS (
  SELECT 1 FROM store_modules sm
  WHERE sm.store_id = s.id AND sm.enabled = true
)
AND mod.module_id IN (
  'commerce', 'blockchain', 'agriculture', 'health', 'logistics', 'education'
)
ON CONFLICT (store_id, module_id) DO UPDATE
SET enabled = true;

-- Keep stores.modules array aligned with enabled store_modules.
UPDATE stores s
SET modules = COALESCE((
  SELECT array_agg(sm.module_id ORDER BY sm.module_id)
  FROM store_modules sm
  WHERE sm.store_id = s.id AND sm.enabled = true
), ARRAY['commerce']::TEXT[])
WHERE true;

-- If a store still has zero modules after backfill, default to commerce.
INSERT INTO store_modules (store_id, module_id, enabled)
SELECT s.id, 'commerce', true
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM store_modules sm WHERE sm.store_id = s.id AND sm.enabled = true
)
ON CONFLICT (store_id, module_id) DO UPDATE SET enabled = true;
