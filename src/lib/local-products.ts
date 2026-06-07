import { notifyAlertsChanged } from "@/lib/alerts";

export interface LocalProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  createdAt?: string;
  stock_quantity?: number;
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeProduct(input: Partial<LocalProduct>): LocalProduct {
  const stock = toNumber(input.stock ?? input.stock_quantity, 0);
  return {
    id: String(input.id ?? `prod-${Date.now()}`),
    name: String(input.name ?? ""),
    description: String(input.description ?? ""),
    price: toNumber(input.price, 0),
    stock,
    stock_quantity: stock,
    category: input.category ? String(input.category) : "Autre",
    createdAt: input.createdAt ? String(input.createdAt) : new Date().toISOString(),
  };
}

export function readLocalProducts(): LocalProduct[] {
  const raw = localStorage.getItem("wazo_products");
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeProduct((item ?? {}) as Partial<LocalProduct>));
  } catch {
    return [];
  }
}

export function writeLocalProducts(products: LocalProduct[]) {
  const normalized = products.map((product) => normalizeProduct(product));
  localStorage.setItem("wazo_products", JSON.stringify(normalized));
  notifyAlertsChanged();
}
