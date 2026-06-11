export type MomoLinkStatus = "pending" | "paid" | "cancelled";

export interface MomoPaymentLink {
  id: string;
  label: string;
  amountFcfa: number;
  customerPhone: string;
  reference: string;
  status: MomoLinkStatus;
  createdAt: string;
  transactionId?: string;
  checkoutUrl?: string;
  publicUrl?: string;
  paymentEnvironment?: string;
  paydunyaLive?: boolean;
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

export function writeMomoLinks(links: MomoPaymentLink[], storeId?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(storeId), JSON.stringify(links));
}

export function createMomoLink(
  input: Omit<MomoPaymentLink, "id" | "reference" | "status" | "createdAt"> & {
    reference?: string;
  },
  storeId?: string
): MomoPaymentLink[] {
  const rows = readMomoLinks(storeId);
  const reference =
    input.reference?.trim() ||
    `WZ${Date.now().toString(36).toUpperCase().slice(-8)}`;
  const link: MomoPaymentLink = {
    ...input,
    id: input.transactionId ? `momo-${input.transactionId}` : `momo-${Date.now()}`,
    reference,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const updated = [link, ...rows].slice(0, 100);
  writeMomoLinks(updated, storeId);
  return updated;
}

export function markMomoLinkPaid(id: string, storeId?: string): MomoPaymentLink[] {
  const updated = readMomoLinks(storeId).map((l) =>
    l.id === id ? { ...l, status: "paid" as const } : l
  );
  writeMomoLinks(updated, storeId);
  return updated;
}

export function applyMomoLinkStatuses(
  links: MomoPaymentLink[],
  statuses: Array<{ transaction_id: string; status: string }>,
  storeId?: string
): MomoPaymentLink[] {
  const byTx = new Map(statuses.map((s) => [s.transaction_id, s.status]));
  const updated = links.map((link) => {
    if (!link.transactionId) return link;
    const remote = byTx.get(link.transactionId);
    if (remote === "succeeded") return { ...link, status: "paid" as const };
    if (remote === "failed") return { ...link, status: "cancelled" as const };
    return link;
  });
  writeMomoLinks(updated, storeId);
  return updated;
}

export function momoLinkWhatsAppMessage(params: {
  storeName: string;
  amountFcfa: number;
  label: string;
  reference: string;
  checkoutUrl?: string;
  publicUrl?: string;
}): string {
  const payLine = params.publicUrl
    ? `Payer en ligne (MoMo) : ${params.publicUrl}`
    : params.checkoutUrl
      ? `Payer maintenant : ${params.checkoutUrl}`
      : "Le commerçant vous enverra le lien PayDunya.";

  return (
    `💳 Paiement Wazo — ${params.storeName}\n` +
    `Montant : ${params.amountFcfa.toLocaleString("fr-FR")} FCFA\n` +
    `Motif : ${params.label}\n` +
    `Référence : ${params.reference}\n\n` +
    `${payLine}\n\n` +
    `Orange Money • MTN MoMo • Moov • Wave`
  );
}
