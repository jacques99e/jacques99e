export interface PharmacyItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expiryDate: string | null;
  minStock: number;
  note: string;
}

const KEY = "wazo_pharmacy_stock";

function storageKey(storeId?: string): string {
  return storeId ? `${KEY}_${storeId}` : KEY;
}

export function readPharmacyStock(storeId?: string): PharmacyItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PharmacyItem[]) : [];
  } catch {
    return [];
  }
}

export function writePharmacyStock(items: PharmacyItem[], storeId?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(storeId), JSON.stringify(items));
}

export function addPharmacyItem(
  item: Omit<PharmacyItem, "id">,
  storeId?: string
): PharmacyItem[] {
  const rows = readPharmacyStock(storeId);
  const next: PharmacyItem = { ...item, id: `med-${Date.now()}` };
  const updated = [next, ...rows];
  writePharmacyStock(updated, storeId);
  return updated;
}

export function updatePharmacyQuantity(
  id: string,
  delta: number,
  storeId?: string
): PharmacyItem[] {
  const rows = readPharmacyStock(storeId);
  const updated = rows.map((item) =>
    item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
  );
  writePharmacyStock(updated, storeId);
  return updated;
}

export function lowStockItems(items: PharmacyItem[]): PharmacyItem[] {
  return items.filter((i) => i.quantity <= i.minStock);
}

export function expiringSoon(items: PharmacyItem[], withinDays = 60): PharmacyItem[] {
  const today = new Date();
  const limit = new Date();
  limit.setDate(limit.getDate() + withinDays);
  return items.filter((i) => {
    if (!i.expiryDate) return false;
    const exp = new Date(i.expiryDate);
    return exp >= today && exp <= limit;
  });
}
