export interface TontineMember {
  id: string;
  name: string;
  phone: string;
  paidRounds: number;
}

export interface TontineGroup {
  id: string;
  name: string;
  contributionFcfa: number;
  cycleWeeks: number;
  members: TontineMember[];
  currentRound: number;
  nextBeneficiaryId: string | null;
  createdAt: string;
}

const KEY = "wazo_tontine";

function storageKey(storeId?: string): string {
  return storeId ? `${KEY}_${storeId}` : KEY;
}

export function readTontines(storeId?: string): TontineGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TontineGroup[]) : [];
  } catch {
    return [];
  }
}

export function writeTontines(groups: TontineGroup[], storeId?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(storeId), JSON.stringify(groups));
}

export function createTontine(
  input: Omit<TontineGroup, "id" | "currentRound" | "nextBeneficiaryId" | "createdAt">,
  storeId?: string
): TontineGroup[] {
  const rows = readTontines(storeId);
  const group: TontineGroup = {
    ...input,
    id: `tontine-${Date.now()}`,
    currentRound: 1,
    nextBeneficiaryId: input.members[0]?.id ?? null,
    createdAt: new Date().toISOString(),
  };
  const updated = [group, ...rows];
  writeTontines(updated, storeId);
  return updated;
}

export function recordTontinePayment(
  groupId: string,
  memberId: string,
  storeId?: string
): TontineGroup[] {
  const rows = readTontines(storeId);
  const updated = rows.map((g) => {
    if (g.id !== groupId) return g;
    const members = g.members.map((m) =>
      m.id === memberId ? { ...m, paidRounds: m.paidRounds + 1 } : m
    );
    return { ...g, members };
  });
  writeTontines(updated, storeId);
  return updated;
}

export function advanceTontineRound(groupId: string, storeId?: string): TontineGroup[] {
  const rows = readTontines(storeId);
  const updated = rows.map((g) => {
    if (g.id !== groupId) return g;
    const idx = g.members.findIndex((m) => m.id === g.nextBeneficiaryId);
    const nextIdx = (idx + 1) % g.members.length;
    return {
      ...g,
      currentRound: g.currentRound + 1,
      nextBeneficiaryId: g.members[nextIdx]?.id ?? null,
    };
  });
  writeTontines(updated, storeId);
  return updated;
}

export function tontinePotTotal(group: TontineGroup): number {
  return group.contributionFcfa * group.members.length;
}

export function getNextRoundDueDate(group: TontineGroup): string {
  const start = new Date(group.createdAt);
  const due = new Date(start);
  due.setDate(start.getDate() + group.currentRound * group.cycleWeeks * 7);
  return due.toISOString().slice(0, 10);
}

export function buildTontineGroupReminder(group: TontineGroup): string {
  const beneficiary = group.members.find((m) => m.id === group.nextBeneficiaryId);
  const unpaid = group.members.filter(
    (m) => m.paidRounds < group.currentRound
  );
  return (
    `📢 Tontine "${group.name}" — Tour ${group.currentRound}\n` +
    `Cotisation : ${group.contributionFcfa.toLocaleString("fr-FR")} FCFA\n` +
    `Bénéficiaire : ${beneficiary?.name ?? "—"}\n` +
    `Échéance : ${getNextRoundDueDate(group)}\n` +
    (unpaid.length
      ? `En attente : ${unpaid.map((m) => m.name).join(", ")}`
      : "Tous les membres sont à jour ✓")
  );
}
