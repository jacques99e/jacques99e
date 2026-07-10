import { slugify } from "@/lib/utils";

export type ProductLandingContent = {
  headline: string;
  subheadline: string;
  bullets: string[];
  cta: string;
  whatsappPitch: string;
  deliveryNote: string;
};

export type ProductLandingRecord = {
  productId: string;
  storeId: string;
  slug: string;
  published: boolean;
  content: ProductLandingContent;
  updatedAt: string;
};

const STORAGE_KEY = "wazo_product_landings";

export function buildFallbackLanding(input: {
  name: string;
  description?: string | null;
  price: number;
  storeName: string;
}): ProductLandingContent {
  const name = input.name.trim() || "Produit";
  const desc =
    input.description?.trim() ||
    `${name} disponible chez ${input.storeName}. Commandez maintenant.`;
  return {
    headline: name,
    subheadline: desc.slice(0, 160),
    bullets: [
      "Qualité vérifiée par le vendeur",
      "Commande simple par WhatsApp",
      "Paiement à la livraison possible",
    ],
    cta: "Commander maintenant",
    whatsappPitch: `Bonjour ${input.storeName}, je veux commander : ${name}.`,
    deliveryNote: "Livraison / retrait à convenir avec le vendeur. Paiement à la livraison accepté.",
  };
}

export function productLandingSlug(name: string, productId: string): string {
  const base = slugify(name) || "produit";
  const suffix = productId.replace(/[^a-zA-Z0-9]/g, "").slice(-6) || "wazo";
  return `${base}-${suffix}`.slice(0, 80);
}

export function readProductLandings(): ProductLandingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProductLandingRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getProductLanding(productId: string): ProductLandingRecord | null {
  return readProductLandings().find((r) => r.productId === productId) || null;
}

export function saveProductLanding(record: ProductLandingRecord): void {
  if (typeof window === "undefined") return;
  const all = readProductLandings().filter((r) => r.productId !== record.productId);
  all.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 200)));
}

export function landingToDescription(content: ProductLandingContent): string {
  const bullets = content.bullets.map((b) => `• ${b}`).join("\n");
  return [
    content.headline,
    "",
    content.subheadline,
    "",
    bullets,
    "",
    content.deliveryNote,
  ]
    .filter(Boolean)
    .join("\n");
}
