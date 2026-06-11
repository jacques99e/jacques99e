export interface VaccinationEntry {
  id: string;
  patientLabel: string;
  vaccine: string;
  dueDate: string;
  done: boolean;
}

export interface CommunitySignal {
  id: string;
  symptom: string;
  count: number;
  week: string;
  level: "low" | "medium" | "high";
}

const KEY_VAX = "wazo_vaccination";
const KEY_SIGNALS = "wazo_community_signals";

const VACCINE_PRESETS = [
  "BCG",
  "Pentavalent",
  "ROR",
  "Fièvre jaune",
  "Méningite A",
  "HPV",
  "COVID-19 rappel",
];

function vaxKey(storeId?: string) {
  return storeId ? `${KEY_VAX}_${storeId}` : KEY_VAX;
}

export function readVaccinations(storeId?: string): VaccinationEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(vaxKey(storeId));
    if (!raw) return [];
    return JSON.parse(raw) as VaccinationEntry[];
  } catch {
    return [];
  }
}

export function addVaccination(
  entry: Omit<VaccinationEntry, "id">,
  storeId?: string
): VaccinationEntry[] {
  const rows = readVaccinations(storeId);
  const next: VaccinationEntry = { ...entry, id: `vax-${Date.now()}` };
  const updated = [next, ...rows];
  localStorage.setItem(vaxKey(storeId), JSON.stringify(updated));
  return updated;
}

export function toggleVaccinationDone(id: string, storeId?: string): VaccinationEntry[] {
  const rows = readVaccinations(storeId);
  const updated = rows.map((r) => (r.id === id ? { ...r, done: !r.done } : r));
  localStorage.setItem(vaxKey(storeId), JSON.stringify(updated));
  return updated;
}

export function vaccinePresets(): string[] {
  return VACCINE_PRESETS;
}

export function buildVaccineCampaignMessage(params: {
  neighborhood: string;
  vaccine: string;
  dueDate: string;
  organizer?: string;
}): string {
  return (
    `💉 Campagne vaccinale — ${params.neighborhood}\n` +
    `Vaccin : ${params.vaccine}\n` +
    `Date : ${params.dueDate}\n` +
    (params.organizer ? `Organisateur : ${params.organizer}\n` : "") +
    `\nRendez-vous au centre de santé ou contactez votre agent de santé communautaire.`
  );
}

export function getCommunitySignals(): CommunitySignal[] {
  if (typeof window === "undefined") return defaultSignals();
  try {
    const raw = localStorage.getItem(KEY_SIGNALS);
    if (raw) return JSON.parse(raw) as CommunitySignal[];
  } catch {
    /* ignore */
  }
  return defaultSignals();
}

function defaultSignals(): CommunitySignal[] {
  const week = new Date().toISOString().slice(0, 10);
  return [
    { id: "fever", symptom: "Fièvre", count: 3, week, level: "low" },
    { id: "cough", symptom: "Toux persistante", count: 5, week, level: "medium" },
    { id: "diarrhea", symptom: "Diarrhée", count: 2, week, level: "low" },
  ];
}

export function reportCommunitySymptom(symptom: string): CommunitySignal[] {
  const signals = getCommunitySignals();
  const week = new Date().toISOString().slice(0, 10);
  const existing = signals.find((s) => s.symptom === symptom && s.week === week);
  const updated: CommunitySignal[] = existing
    ? signals.map((s) =>
        s.id === existing.id
          ? {
              ...s,
              count: s.count + 1,
              level: (s.count + 1 >= 8 ? "high" : s.count + 1 >= 4 ? "medium" : "low") as CommunitySignal["level"],
            }
          : s
      )
    : [
        {
          id: `sig-${Date.now()}`,
          symptom,
          count: 1,
          week,
          level: "low" as const,
        },
        ...signals,
      ];
  localStorage.setItem(KEY_SIGNALS, JSON.stringify(updated));
  return updated;
}
