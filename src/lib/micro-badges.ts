export interface MicroBadge {
  id: string;
  title: string;
  skill: string;
  learnerName: string;
  courseTitle: string;
  issuedAt: string;
  verifyToken: string;
}

const KEY = "wazo_micro_badges";

function storageKey(storeId?: string) {
  return storeId ? `${KEY}_${storeId}` : KEY;
}

export function readMicroBadges(storeId?: string): MicroBadge[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    if (!raw) return [];
    return JSON.parse(raw) as MicroBadge[];
  } catch {
    return [];
  }
}

export function issueMicroBadge(
  input: Omit<MicroBadge, "id" | "issuedAt" | "verifyToken">,
  storeId?: string
): MicroBadge[] {
  const rows = readMicroBadges(storeId);
  const token = `WB-${Date.now().toString(36).toUpperCase()}`;
  const badge: MicroBadge = {
    ...input,
    id: `badge-${Date.now()}`,
    issuedAt: new Date().toISOString(),
    verifyToken: token,
  };
  const updated = [badge, ...rows];
  localStorage.setItem(storageKey(storeId), JSON.stringify(updated));
  return updated;
}

export function badgeVerifyUrl(token: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || "https://wazo-digital.vercel.app").replace(/\/$/, "");
  return `${base}/formation/verify/${encodeURIComponent(token)}`;
}

export const SKILL_PRESETS = [
  "Excel de base",
  "Comptabilité simplifiée",
  "Hygiène alimentaire",
  "Premiers secours",
  "Marketing WhatsApp",
  "Agriculture biologique",
  "Conduite sécurisée",
];
