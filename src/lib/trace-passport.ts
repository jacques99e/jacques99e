export interface ProductPassport {
  id: string;
  productName: string;
  assetHash: string;
  cooperative: string;
  harvestDate: string;
  region: string;
  certifications: string[];
  farmerStory: string;
  carbonEstimateKg: number;
  createdAt: string;
}

const KEY = "wazo_product_passports";

function storageKey(storeId?: string) {
  return storeId ? `${KEY}_${storeId}` : KEY;
}

export function readPassports(storeId?: string): ProductPassport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    if (!raw) return [];
    return JSON.parse(raw) as ProductPassport[];
  } catch {
    return [];
  }
}

export function createPassport(
  input: Omit<ProductPassport, "id" | "createdAt">,
  storeId?: string
): ProductPassport[] {
  const rows = readPassports(storeId);
  const passport: ProductPassport = {
    ...input,
    id: `pass-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [passport, ...rows];
  localStorage.setItem(storageKey(storeId), JSON.stringify(updated));
  return updated;
}

export function passportShareText(passport: ProductPassport, traceLink: string): string {
  return (
    `🌍 PASSEPORT PRODUIT WAZO\n` +
    `Produit : ${passport.productName}\n` +
    `Origine : ${passport.region} — ${passport.cooperative}\n` +
    `Récolte : ${passport.harvestDate}\n` +
    `Certifications : ${passport.certifications.join(", ") || "—"}\n` +
    `Empreinte estimée : ${passport.carbonEstimateKg} kg CO₂e\n` +
    `Vérifier : ${traceLink}\n\n` +
    `${passport.farmerStory}`
  );
}
