import Dexie, { type Table } from "dexie";
import type {
  BlockchainAsset,
  BlockchainLedgerEntry,
  Course,
  Delivery,
  FarmParcel,
  HealthPatient,
  Product,
  Sale,
  Store,
  SyncQueueItem,
} from "@/types";
import type { ModuleId } from "@/types";

const AUTH_TOKEN_KEY = "wazo_auth_token";
const AUTH_USER_KEY = "wazo_auth_user";
const STORE_KEY = "wazo_current_store";
const LANG_KEY = "wazo_language";
const MODULES_KEY = "wazo_active_modules";
const DARK_KEY = "wazo_dark_mode";

export class WazoDatabase extends Dexie {
  products!: Table<Product & { _localId?: string }>;
  sales!: Table<Sale>;
  saleItems!: Table<{
    id?: string;
    sale_local_id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  syncQueue!: Table<SyncQueueItem>;
  store!: Table<Store>;
  blockchainAssets!: Table<BlockchainAsset>;
  blockchainLedger!: Table<BlockchainLedgerEntry>;
  farmParcels!: Table<FarmParcel>;
  healthPatients!: Table<HealthPatient>;
  deliveries!: Table<Delivery>;
  courses!: Table<Course>;

  constructor() {
    super("WazoDigital");
    this.version(1).stores({
      products: "id, store_id, name, barcode, _localId, _pendingSync",
      sales: "id, store_id, created_at, _localId, _pendingSync",
      saleItems: "++id, sale_local_id, product_id",
      syncQueue: "++id, entity_type, entity_id, created_at",
      store: "id, owner_id, slug",
    });
    this.version(2).stores({
      products: "id, store_id, name, barcode, _localId, _pendingSync",
      sales: "id, store_id, created_at, _localId, _pendingSync",
      saleItems: "++id, sale_local_id, product_id",
      syncQueue: "++id, entity_type, entity_id, created_at",
      store: "id, owner_id, slug",
      blockchainAssets: "id, store_id, hash_sha256, _localId, _pendingSync",
      blockchainLedger: "id, store_id, created_at",
      farmParcels: "id, store_id, _localId, _pendingSync",
      healthPatients: "id, store_id, _localId, _pendingSync",
      deliveries: "id, store_id, tracking_code, _localId, _pendingSync",
      courses: "id, store_id, _localId, _pendingSync",
    });
  }
}

export const db =
  typeof window !== "undefined" ? new WazoDatabase() : (null as unknown as WazoDatabase);

export const localAuth = {
  saveSession(token: string, user: { id: string; phone?: string }) {
    if (typeof window === "undefined") return;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  },
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },
  getUser(): { id: string; phone?: string } | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  },
};

export const localStore = {
  save(store: Store) {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  },
  get(): Store | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORE_KEY);
  },
};

export const localLang = {
  get(): string {
    if (typeof window === "undefined") return "fr";
    return localStorage.getItem(LANG_KEY) || "fr";
  },
  set(lang: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem(LANG_KEY, lang);
  },
};

export const localModules = {
  get(): ModuleId[] {
    if (typeof window === "undefined") return ["commerce"];
    const raw = localStorage.getItem(MODULES_KEY);
    if (!raw) return ["commerce"];
    try {
      return JSON.parse(raw) as ModuleId[];
    } catch {
      return ["commerce"];
    }
  },
  save(modules: ModuleId[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(MODULES_KEY, JSON.stringify(modules));
  },
};

export const localTheme = {
  getDark(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DARK_KEY) === "1";
  },
  setDark(dark: boolean) {
    if (typeof window === "undefined") return;
    localStorage.setItem(DARK_KEY, dark ? "1" : "0");
    document.documentElement.classList.toggle("dark", dark);
  },
};
