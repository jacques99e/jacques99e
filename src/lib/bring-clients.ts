import { PROD_APP_URL } from "@/lib/site-urls";
import { isSafeStoreSlug } from "@/lib/utils";

export type BringClientStepId = "link" | "status" | "contacts" | "qr" | "caisse";

export const BRING_STEP_IDS: BringClientStepId[] = [
  "link",
  "status",
  "contacts",
  "qr",
  "caisse",
];

export type BringClientProgress = {
  completed: BringClientStepId[];
  stepIndex: number;
};

const EMPTY: BringClientProgress = { completed: [], stepIndex: 0 };

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

function isStepId(value: unknown): value is BringClientStepId {
  return typeof value === "string" && BRING_STEP_IDS.includes(value as BringClientStepId);
}

function clampIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(BRING_STEP_IDS.length - 1, Math.max(0, Math.round(index)));
}

export function migrateBringClientProgress(raw: unknown): BringClientProgress {
  if (!raw || typeof raw !== "object") return EMPTY;
  const parsed = raw as Record<string, unknown>;

  if (Array.isArray(parsed.completed)) {
    const completed = parsed.completed.filter(isStepId);
    return {
      completed: [...new Set(completed)],
      stepIndex: clampIndex(Number(parsed.stepIndex) || 0),
    };
  }

  const completed: BringClientStepId[] = [];
  if (parsed.status) completed.push("status");
  if (parsed.contacts) completed.push("contacts");
  if (parsed.qr) completed.push("qr");
  const firstOpen = BRING_STEP_IDS.findIndex((id) => !completed.includes(id));
  return {
    completed,
    stepIndex: firstOpen < 0 ? BRING_STEP_IDS.length - 1 : firstOpen,
  };
}

export function readBringClientProgress(storeId?: string): BringClientProgress {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    if (!raw) return EMPTY;
    return migrateBringClientProgress(JSON.parse(raw));
  } catch {
    return EMPTY;
  }
}

export function writeBringClientProgress(
  storeId: string | undefined,
  next: BringClientProgress
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    storageKey(storeId),
    JSON.stringify({
      completed: next.completed.filter(isStepId),
      stepIndex: clampIndex(next.stepIndex),
    })
  );
}

export function isBringClientsComplete(storeId?: string): boolean {
  const progress = readBringClientProgress(storeId);
  return BRING_STEP_IDS.every((id) => progress.completed.includes(id));
}

export function markBringStepDone(
  progress: BringClientProgress,
  stepId: BringClientStepId
): BringClientProgress {
  const completed = progress.completed.includes(stepId)
    ? progress.completed
    : [...progress.completed, stepId];
  const currentPos = BRING_STEP_IDS.indexOf(stepId);
  const nextIndex =
    currentPos >= 0 && currentPos < BRING_STEP_IDS.length - 1
      ? currentPos + 1
      : progress.stepIndex;
  return { completed, stepIndex: nextIndex };
}
