-- Wazo Digital - Initial Schema
-- Resynchronise avec le schema reellement deploye sur Supabase (introspection PostgREST).
-- Run in Supabase SQL Editor.

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- phone est UNIQUE mais nullable: les comptes email/anonymes n'ont pas de
  -- telephone, et plusieurs NULL sont autorises sous une contrainte UNIQUE.
  phone TEXT UNIQUE,
  full_name TEXT,
  language TEXT DEFAULT 'fr' CHECK (language IN ('fr', 'en', 'sw', 'wo')),
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'employee', 'client', 'patient', 'student', 'driver')),
  active_modules JSONB DEFAULT '["commerce"]'::jsonb,
  dark_mode BOOLEAN DEFAULT false,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Stores (boutiques)
-- NOTE: owner_id reference profiles(id), PAS auth.users(id).
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  photo_url TEXT,
  logo_url TEXT,
  cover_url TEXT,
  phone TEXT,
  whatsapp TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  modules TEXT[] DEFAULT ARRAY['commerce']::TEXT[],
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores(owner_id);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  barcode TEXT,
  photo_url TEXT,
  category TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_store ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);

-- Sale items
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Profiles policies (profiles.id == auth.users.id)
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Stores policies (owner_id == profiles.id == auth.uid())
DROP POLICY IF EXISTS "Owners manage stores" ON stores;
DROP POLICY IF EXISTS "Public read stores by slug" ON stores;
CREATE POLICY "Owners manage stores" ON stores FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Public read stores by slug" ON stores FOR SELECT USING (is_public = true);

-- Products policies
DROP POLICY IF EXISTS "Store owners manage products" ON products;
DROP POLICY IF EXISTS "Public read products" ON products;
CREATE POLICY "Store owners manage products" ON products FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "Public read products" ON products FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE is_public = true));

-- Sales policies
DROP POLICY IF EXISTS "Store owners manage sales" ON sales;
CREATE POLICY "Store owners manage sales" ON sales FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Sale items policies
DROP POLICY IF EXISTS "Store owners manage sale items" ON sale_items;
CREATE POLICY "Store owners manage sale items" ON sale_items FOR ALL
  USING (
    sale_id IN (
      SELECT s.id FROM sales s
      JOIN stores st ON s.store_id = st.id
      WHERE st.owner_id = auth.uid()
    )
  );

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated upload images" ON storage.objects;
DROP POLICY IF EXISTS "Public read images" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete images" ON storage.objects;
CREATE POLICY "Authenticated upload images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');
CREATE POLICY "Public read images" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');
CREATE POLICY "Owners delete images" ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger: auto-create profile on signup (robuste: phone NOT NULL, idempotent)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone)
  VALUES (NEW.id, NULLIF(NEW.phone, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
