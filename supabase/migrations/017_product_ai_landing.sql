-- Product AI landing pages + COD orders (017)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS landing_content JSONB,
  ADD COLUMN IF NOT EXISTS landing_published BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_store_slug
  ON products(store_id, slug)
  WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  address TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash_on_delivery',
  status TEXT NOT NULL DEFAULT 'pending',
  locale TEXT DEFAULT 'fr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_orders_store ON product_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_product ON product_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_status ON product_orders(status);

ALTER TABLE product_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_owners_read_product_orders" ON product_orders;
CREATE POLICY "store_owners_read_product_orders" ON product_orders
  FOR SELECT USING (public.can_access_store(store_id));

DROP POLICY IF EXISTS "public_insert_product_orders" ON product_orders;
CREATE POLICY "public_insert_product_orders" ON product_orders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      JOIN stores s ON s.id = p.store_id
      WHERE p.id = product_id
        AND p.store_id = product_orders.store_id
        AND p.landing_published = true
        AND s.is_public = true
    )
  );

-- Public read published product landings (anon storefront)
DROP POLICY IF EXISTS "public_read_published_products" ON products;
CREATE POLICY "public_read_published_products" ON products
  FOR SELECT USING (
    landing_published = true
    AND EXISTS (
      SELECT 1 FROM stores s
      WHERE s.id = products.store_id
        AND s.is_public = true
    )
  );
