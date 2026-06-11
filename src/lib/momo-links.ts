export type MomoLinkStatus = "pending" | "paid" | "cancelled";

export interface MomoPaymentLink {
  id: string;
  label: string;
  amountFcfa: number;
  customerPhone: string;
  reference: string;
  status: MomoLinkStatus;
  createdAt: string;
}

const KEY = "wazo_momo_links";

function storageKey(storeId?: string) {
  return storeId ? `${KEY}_${storeId}` : KEY;
}

export function readMomoLinks(storeId?: string): MomoPaymentLink[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    if (!raw) return [];
    return JSON.parse(raw) as MomoPaymentLink[];
  } catch {
    return [];
  }
}

export function createMomoLink(
  input: Omit<MomoPaymentLink, "id" | "reference" | "status" | "createdAt">,
  storeId?: string
): MomoPaymentLink[] {
  const rows = readMomoLinks(storeId);
  const reference = `WZ${Date.now().toString(36).toUpperCase().slice(-8)}`;
  const link: MomoPaymentLink = {
    ...input,
    id: `momo-${Date.now()}`,
    reference,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const updated = [link, ...rows].slice(0, 100);
  localStorage.setItem(storageKey(storeId), JSON.stringify(updated));
  return updated;
}

export function markMomoLinkPaid(id: string, storeId?: string): MomoPaymentLink[] {
  const updated = readMomoLinks(storeId).map((l) =>
    l.id === id ? { ...l, status: "paid" as const } : l
  );
  localStorage.setItem(storageKey(storeId), JSON.stringify(updated));
  return updated;
}

export function momoLinkWhatsAppMessage(params: {
  storeName: string;
  amountFcfa: number;
  label: string;
  reference: string;
}): string {
  return (
    `💳 Demande de paiement — ${params.storeName}\n` +
    `Montant : ${params.amountFcfa.toLocaleString("fr-FR")} FCFA\n` +
    `Motif : ${params.label}\n` +
    `Référence : ${params.reference}\n\n` +
    `Merci d'effectuer le paiement Mobile Money (Orange / MTN / Moov) et d'envoyer la capture ici.`
  );
}
