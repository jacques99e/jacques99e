export type CreditEntryType = "debt" | "payment";

export interface CreditEntry {
  id: string;
  clientName: string;
  clientPhone: string;
  amount: number;
  type: CreditEntryType;
  note: string;
  createdAt: string;
}

const KEY = "wazo_credit_ledger";

function storageKey(storeId?: string): string {
  return storeId ? `${KEY}_${storeId}` : KEY;
}

export function readCreditLedger(storeId?: string): CreditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CreditEntry[]) : [];
  } catch {
    return [];
  }
}

export function writeCreditLedger(entries: CreditEntry[], storeId?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(storeId), JSON.stringify(entries));
}

export function addCreditEntry(
  entry: Omit<CreditEntry, "id" | "createdAt">,
  storeId?: string
): CreditEntry[] {
  const rows = readCreditLedger(storeId);
  const next: CreditEntry = {
    ...entry,
    id: `credit-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [next, ...rows].slice(0, 200);
  writeCreditLedger(updated, storeId);
  return updated;
}

export function balanceByClient(entries: CreditEntry[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of entries) {
    const key = row.clientPhone || row.clientName;
    const delta = row.type === "debt" ? row.amount : -row.amount;
    map[key] = (map[key] ?? 0) + delta;
  }
  return map;
}

export function totalOutstanding(entries: CreditEntry[]): number {
  const balances = balanceByClient(entries);
  return Object.values(balances).reduce((sum, v) => sum + Math.max(0, v), 0);
}
