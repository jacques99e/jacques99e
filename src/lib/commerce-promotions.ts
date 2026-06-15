import { localStore } from "@/lib/db";
import { generateLocalId } from "@/lib/sync";

export interface CommercePromotion {
  id: string;
  store_id: string;
  label: string;
  discount_percent: number;
  product_ids: string[];
  ends_at: string;
  active: boolean;
}

function storageKey(storeId: string) {
  return `wazo_commerce_promos_${storeId}`;
}

export function listPromotions(storeId?: string): CommercePromotion[] {
  const sid = storeId ?? localStore.get()?.id;
  if (!sid || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(sid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CommercePromotion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePromotions(storeId: string, rows: CommercePromotion[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(storeId), JSON.stringify(rows));
}

export function addPromotion(
  storeId: string,
  input: Omit<CommercePromotion, "id" | "store_id">
): CommercePromotion {
  const row: CommercePromotion = {
    id: generateLocalId(),
    store_id: storeId,
    ...input,
  };
  savePromotions(storeId, [row, ...listPromotions(storeId)]);
  return row;
}

export function updatePromotion(storeId: string, row: CommercePromotion) {
  savePromotions(
    storeId,
    listPromotions(storeId).map((p) => (p.id === row.id ? row : p))
  );
}

export function deletePromotion(storeId: string, id: string) {
  savePromotions(
    storeId,
    listPromotions(storeId).filter((p) => p.id !== id)
  );
}

export function activePromotions(storeId?: string, today = new Date()): CommercePromotion[] {
  const iso = today.toISOString().slice(0, 10);
  return listPromotions(storeId).filter(
    (p) => p.active && p.discount_percent > 0 && p.ends_at >= iso
  );
}

export function discountForProduct(
  productId: string,
  storeId?: string
): { percent: number; label: string } | null {
  const promos = activePromotions(storeId);
  let best: CommercePromotion | null = null;
  for (const promo of promos) {
    const applies =
      !promo.product_ids.length || promo.product_ids.includes(productId);
    if (!applies) continue;
    if (!best || promo.discount_percent > best.discount_percent) best = promo;
  }
  if (!best) return null;
  return { percent: best.discount_percent, label: best.label };
}

export function applyDiscount(price: number, percent: number): number {
  return Math.max(0, Math.round(price * (1 - percent / 100)));
}
