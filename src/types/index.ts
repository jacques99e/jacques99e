export type Language = "fr" | "en" | "sw" | "wo";

export type ModuleId =
  | "commerce"
  | "blockchain"
  | "agriculture"
  | "health"
  | "logistics"
  | "education";

export type UserRole =
  | "owner"
  | "employee"
  | "client"
  | "patient"
  | "student"
  | "driver";

export type PaymentMethod =
  | "orange_money"
  | "mtn_momo"
  | "moov_money"
  | "mpesa"
  | "cash";

export interface Profile {
  id: string;
  phone: string | null;
  full_name: string | null;
  preferred_language: Language;
  role?: UserRole;
  active_modules?: ModuleId[];
  dark_mode?: boolean;
  avatar_url?: string | null;
  created_at?: string;
}

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  cover_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_public: boolean;
  created_at?: string;
}

export interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  barcode: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  _localId?: string;
  _pendingSync?: boolean;
}

export interface SaleItem {
  id?: string;
  sale_id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  store_id: string;
  total_amount: number;
  payment_method: PaymentMethod | string | null;
  payment_status: string;
  client_local_id?: string | null;
  created_at?: string;
  items?: SaleItem[];
  _localId?: string;
  _pendingSync?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface SyncQueueItem {
  id?: number;
  entity_type: string;
  entity_id: string;
  action: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  created_at: number;
}

// Blockchain
export interface BlockchainAsset {
  id: string;
  store_id: string;
  name: string;
  asset_type: string;
  description?: string | null;
  hash_sha256: string;
  metadata?: Record<string, unknown>;
  latitude?: number | null;
  longitude?: number | null;
  recorded_at?: string;
  _localId?: string;
  _pendingSync?: boolean;
}

export interface BlockchainLedgerEntry {
  id: string;
  store_id: string;
  asset_id?: string | null;
  action: string;
  hash_sha256: string;
  prev_hash?: string | null;
  payload?: Record<string, unknown>;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
}

export interface BlockchainContract {
  id: string;
  store_id: string;
  title: string;
  contract_type: string;
  rules: Record<string, unknown>;
  participants: unknown[];
  status: string;
  created_at?: string;
}

// Agriculture
export type FarmStage = "growth" | "flowering" | "harvest" | "fallow";

export interface FarmParcel {
  id: string;
  store_id: string;
  name: string;
  area_hectares: number;
  crop_type: string;
  sowing_date?: string | null;
  stage: FarmStage;
  expected_yield_kg?: number | null;
  harvested_kg?: number;
  latitude?: number | null;
  longitude?: number | null;
  _localId?: string;
  _pendingSync?: boolean;
}

export interface FarmInput {
  id: string;
  parcel_id: string;
  input_type: string;
  quantity: number;
  unit: string;
  applied_at: string;
  notes?: string | null;
}

// Health
export interface HealthPatient {
  id: string;
  store_id: string;
  full_name: string;
  age?: number | null;
  blood_group?: string | null;
  allergies?: string | null;
  medical_history?: string | null;
  phone?: string | null;
  _localId?: string;
  _pendingSync?: boolean;
}

export interface HealthAppointment {
  id: string;
  store_id: string;
  patient_id?: string | null;
  scheduled_at: string;
  status: string;
  notes?: string | null;
}

export interface HealthVital {
  id: string;
  patient_id: string;
  weight_kg?: number | null;
  blood_pressure?: string | null;
  temperature_c?: number | null;
  recorded_at?: string;
}

// Logistics
export type DeliveryStatus =
  | "pending"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "cancelled";

export interface Delivery {
  id: string;
  store_id: string;
  tracking_code: string;
  sender_name: string;
  recipient_name: string;
  recipient_phone?: string | null;
  address: string;
  status: DeliveryStatus;
  signature_data?: string | null;
  route_summary?: string | null;
  created_at?: string;
  updated_at?: string;
  _localId?: string;
  _pendingSync?: boolean;
}

// Education
export interface Course {
  id: string;
  store_id: string;
  title: string;
  description?: string | null;
  invite_code?: string;
  is_public?: boolean;
  created_at?: string;
  _localId?: string;
  _pendingSync?: boolean;
}

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  content?: string | null;
  media_url?: string | null;
  sort_order: number;
}

export interface CourseEnrollment {
  id: string;
  course_id: string;
  student_name: string;
  student_email?: string | null;
  progress_percent: number;
  completed_at?: string | null;
}

export interface Message {
  id: string;
  store_id: string;
  room_id: string;
  sender_id?: string | null;
  sender_name?: string | null;
  body: string;
  created_at?: string;
}
