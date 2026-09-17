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

function createDb(): WazoDatabase | null {
  if (typeof window === "undefined") return null;
  const openingKey = "wazo_idb_opening";
  const disabledKey = "wazo_idb_disabled";
  try {
    if (localStorage.getItem(disabledKey) === "1") return null;
    if (localStorage.getItem(openingKey) === "1") {
      localStorage.removeItem(openingKey);
      localStorage.setItem(disabledKey, "1");
      try {
        indexedDB.deleteDatabase("WazoDigital");
      } catch {
        // ignore
      }
      return null;
    }
    localStorage.setItem(openingKey, "1");
    const instance = new WazoDatabase();
    void instance
      .open()
      .then(() => {
        localStorage.removeItem(openingKey);
      })
      .catch(() => {
        localStorage.removeItem(openingKey);
        localStorage.setItem(disabledKey, "1");
        try {
          indexedDB.deleteDatabase("WazoDigital");
        } catch {
          // ignore
        }
      });
    return instance;
  } catch {
    try {
      localStorage.removeItem(openingKey);
    } catch {
      // ignore
    }
    return null;
  }
}

export const db = createDb() as WazoDatabase;

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // quota / mode privé
  }
}

function removeStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function readJson<T>(key: string): T | null {
  const raw = readStorage(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const localAuth = {
  saveSession(token: string, user: { id: string; phone?: string }) {
    writeStorage(AUTH_TOKEN_KEY, token);
    writeStorage(AUTH_USER_KEY, JSON.stringify(user));
  },
  getToken(): string | null {
    return readStorage(AUTH_TOKEN_KEY);
  },
  getUser(): { id: string; phone?: string } | null {
    return readJson<{ id: string; phone?: string }>(AUTH_USER_KEY);
  },
  clear() {
    removeStorage(AUTH_TOKEN_KEY);
    removeStorage(AUTH_USER_KEY);
  },
};

export const localStore = {
  save(store: Store) {
    writeStorage(STORE_KEY, JSON.stringify(store));
  },
  get(): Store | null {
    return readJson<Store>(STORE_KEY);
  },
  clear() {
    removeStorage(STORE_KEY);
  },
};

export const localLang = {
  get(): string {
    return readStorage(LANG_KEY) || "fr";
  },
  set(lang: string) {
    writeStorage(LANG_KEY, lang);
  },
};

export const localModules = {
  get(): ModuleId[] {
    return readJson<ModuleId[]>(MODULES_KEY) || ["commerce"];
  },
  save(modules: ModuleId[]) {
    writeStorage(MODULES_KEY, JSON.stringify(modules));
  },
};

export const localTheme = {
  getDark(): boolean {
    return readStorage(DARK_KEY) === "1";
  },
  setDark(dark: boolean) {
    writeStorage(DARK_KEY, dark ? "1" : "0");
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", dark);
    }
  },
};
