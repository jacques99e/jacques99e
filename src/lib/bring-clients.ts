import { PROD_APP_URL } from "@/lib/site-urls";
import { isSafeStoreSlug } from "@/lib/utils";

export type BringClientActionId = "status" | "contacts" | "qr";

export type BringClientProgress = {
  status: boolean;
  contacts: boolean;
  qr: boolean;
};

const EMPTY: BringClientProgress = { status: false, contacts: false, qr: false };

function storageKey(storeId?: string): string {
  return storeId ? `wazo_bring_clients_${storeId}` : "wazo_bring_clients";
}

export function boutiquePublicUrl(slug?: string | null): string | null {
  const clean = slug?.trim().toLowerCase();
  if (!isSafeStoreSlug(clean)) return null;
  return `${PROD_APP_URL}/boutique/${clean}`;
}

export function boutiqueShareText(storeName: string, url: string): string {
  const safeName = storeName.replace(/[\r\n\t]+/g, " ").trim().slice(0, 80) || "Ma boutique";
  return [
    `Découvrez ${safeName} !`,
    "Commandez ici (lien boutique) :",
    url,
    "",
    "Répondez-moi ici pour passer commande.",
  ].join("\n");
}

export function readBringClientProgress(storeId?: string): BringClientProgress {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<BringClientProgress>;
    return {
      status: Boolean(parsed.status),
      contacts: Boolean(parsed.contacts),
      qr: Boolean(parsed.qr),
    };
  } catch {
    return EMPTY;
  }
}

export function writeBringClientProgress(
  storeId: string | undefined,
  next: BringClientProgress
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(storeId), JSON.stringify(next));
}
