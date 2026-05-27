-- Wazo Digital — Platform modules extension
-- Run after 001_initial_schema.sql

-- Extend profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner'
  CHECK (role IN ('owner', 'employee', 'client', 'patient', 'student', 'driver'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_modules JSONB DEFAULT '["commerce"]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Extend stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Store module activation
CREATE TABLE IF NOT EXISTS store_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL CHECK (module_id IN (
    'commerce', 'blockchain', 'agriculture', 'health', 'logistics', 'education'
  )),
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, module_id)
);

CREATE INDEX idx_store_modules_store ON store_modules(store_id);

-- Dashboard widgets per store
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  widget_key TEXT NOT NULL,
  module_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, widget_key)
);

-- BLOCKCHAIN
CREATE TABLE IF NOT EXISTS blockchain_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  description TEXT,
  hash_sha256 TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blockchain_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES blockchain_assets(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  hash_sha256 TEXT NOT NULL,
  prev_hash TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blockchain_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  contract_type TEXT DEFAULT 'cooperative',
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  participants JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AGRICULTURE
CREATE TABLE IF NOT EXISTS farm_parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area_hectares DECIMAL(10, 4) NOT NULL DEFAULT 0,
  crop_type TEXT NOT NULL,
  sowing_date DATE,
  stage TEXT DEFAULT 'growth' CHECK (stage IN ('growth', 'flowering', 'harvest', 'fallow')),
  expected_yield_kg DECIMAL(12, 2),
  harvested_kg DECIMAL(12, 2) DEFAULT 0,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES farm_parcels(id) ON DELETE CASCADE,
  input_type TEXT NOT NULL,
  quantity DECIMAL(12, 2),
  unit TEXT DEFAULT 'kg',
  applied_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  parcel_id UUID REFERENCES farm_parcels(id) ON DELETE SET NULL,
  record_type TEXT NOT NULL,
  notes TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HEALTH
CREATE TABLE IF NOT EXISTS health_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  age INTEGER,
  blood_group TEXT,
  allergies TEXT,
  medical_history TEXT,
  phone TEXT,
  encrypted_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES health_patients(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'done')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES health_patients(id) ON DELETE CASCADE,
  medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  doctor_name TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES health_patients(id) ON DELETE CASCADE,
  weight_kg DECIMAL(6, 2),
  blood_pressure TEXT,
  temperature_c DECIMAL(4, 1),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medication_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES health_patients(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  schedule_cron TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LOGISTICS
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  tracking_code TEXT NOT NULL UNIQUE,
  sender_name TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT,
  address TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'picked_up', 'in_transit', 'delivered', 'cancelled'
  )),
  driver_id UUID REFERENCES auth.users(id),
  signature_data TEXT,
  route_summary TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EDUCATION
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  media_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT,
  progress_percent INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  certificate_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  passing_score INTEGER DEFAULT 70,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages (cross-module chat)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  sender_id UUID REFERENCES auth.users(id),
  sender_name TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_room ON messages(room_id, created_at DESC);

-- RLS helper
CREATE OR REPLACE FUNCTION user_store_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM stores WHERE owner_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS on new tables
ALTER TABLE store_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockchain_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockchain_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockchain_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Generic owner policies
CREATE POLICY "owners_store_modules" ON store_modules FOR ALL
  USING (store_id IN (SELECT user_store_ids()));
CREATE POLICY "owners_dashboard_widgets" ON dashboard_widgets FOR ALL
  USING (store_id IN (SELECT user_store_ids()));
CREATE POLICY "owners_blockchain_assets" ON blockchain_assets FOR ALL
  USING (store_id IN (SELECT user_store_ids()));
CREATE POLICY "owners_blockchain_ledger" ON blockchain_ledger FOR ALL
  USING (store_id IN (SELECT user_store_ids()));
CREATE POLICY "owners_blockchain_contracts" ON blockchain_contracts FOR ALL
  USING (store_id IN (SELECT user_store_ids()));
CREATE POLICY "owners_farm_parcels" ON farm_parcels FOR ALL
  USING (store_id IN (SELECT user_store_ids()));
CREATE POLICY "owners_farm_records" ON farm_records FOR ALL
  USING (store_id IN (SELECT user_store_ids()));
CREATE POLICY "owners_farm_inputs" ON farm_inputs FOR ALL
  USING (parcel_id IN (SELECT id FROM farm_parcels WHERE store_id IN (SELECT user_store_ids())));
CREATE POLICY "owners_health_patients" ON health_patients FOR ALL
  USING (store_id IN (SELECT user_store_ids()));
CREATE POLICY "owners_health_appointments" ON health_appointments FOR ALL
  USING (store_id IN (SELECT user_store_ids()));
CREATE POLICY "owners_health_prescriptions" ON health_prescriptions FOR ALL
  USING (store_id IN (SELECT user_store_ids()));
CREATE POLICY "owners_health_vitals" ON health_vitals FOR ALL
  USING (patient_id IN (SELECT id FROM health_patients WHERE store_id IN (SELECT user_store_ids())));
CREATE POLICY "owners_medication_reminders" ON medication_reminders FOR ALL
  USING (patient_id IN (SELECT id FROM health_patients WHERE store_id IN (SELECT user_store_ids())));
CREATE POLICY "owners_deliveries" ON deliveries FOR ALL
  USING (store_id IN (SELECT user_store_ids()));
CREATE POLICY "owners_courses" ON courses FOR ALL
  USING (store_id IN (SELECT user_store_ids()));
CREATE POLICY "owners_course_modules" ON course_modules FOR ALL
  USING (course_id IN (SELECT id FROM courses WHERE store_id IN (SELECT user_store_ids())));
CREATE POLICY "owners_course_enrollments" ON course_enrollments FOR ALL
  USING (course_id IN (SELECT id FROM courses WHERE store_id IN (SELECT user_store_ids())));
CREATE POLICY "owners_course_quizzes" ON course_quizzes FOR ALL
  USING (course_id IN (SELECT id FROM courses WHERE store_id IN (SELECT user_store_ids())));
CREATE POLICY "owners_course_resources" ON course_resources FOR ALL
  USING (course_id IN (SELECT id FROM courses WHERE store_id IN (SELECT user_store_ids())));
CREATE POLICY "owners_messages" ON messages FOR ALL
  USING (store_id IN (SELECT user_store_ids()));

-- Public read for courses with invite
CREATE POLICY "public_read_courses_invite" ON courses FOR SELECT USING (is_public = true);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('health-docs', 'health-docs', false),
  ('course-media', 'course-media', true),
  ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_upload_health" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'health-docs' AND auth.role() = 'authenticated');
CREATE POLICY "auth_upload_course" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('course-media', 'certificates') AND auth.role() = 'authenticated');
