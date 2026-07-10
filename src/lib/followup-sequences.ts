import type { LocalClientRecord } from "@/lib/local-clients";
import { buildMessageFromTemplate } from "@/lib/whatsapp";

/** Étapes de séquence : J+1 puis J+3 après démarrage. */
export type SequenceStep = 1 | 2;

export type SequenceDueItem = {
  client: LocalClientRecord;
  step: SequenceStep;
  label: string;
  reason: string;
  overdue: boolean;
};

export function addDaysISO(baseISO: string, days: number): string {
  const d = new Date(`${baseISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sequenceStepLabel(step: SequenceStep): string {
  return step === 1 ? "Relance J+1" : "Relance J+3";
}

export function sequenceTemplateId(step: SequenceStep): string {
  return step === 1 ? "followup_j1" : "followup_j3";
}

/** Démarre une séquence J+1 → J+3 (prochaine relance = demain). */
export function startFollowUpSequence(
  client: LocalClientRecord,
  fromDate = todayISO()
): LocalClientRecord {
  return {
    ...client,
    status: client.status === "active" ? "relance" : client.status,
    sequenceStep: 1,
    sequenceStartedAt: fromDate,
    lastRelanceAt: client.lastRelanceAt ?? null,
    nextFollowUp: addDaysISO(fromDate, 1),
  };
}

/** Après envoi WhatsApp d’une étape : planifie J+3 ou termine. */
export function advanceFollowUpSequence(
  client: LocalClientRecord,
  sentAt = todayISO()
): LocalClientRecord {
  const step = client.sequenceStep ?? 1;
  if (step === 1) {
    return {
      ...client,
      status: "relance",
      sequenceStep: 2,
      lastRelanceAt: sentAt,
      nextFollowUp: addDaysISO(sentAt, 2), // J+3 depuis le début ≈ +2 depuis J+1
      note: client.note?.includes("Séquence")
        ? client.note
        : [client.note, "Séquence: J+1 envoyée, J+3 prévue"]
            .filter(Boolean)
            .join(" · "),
    };
  }

  return {
    ...client,
    status: "active",
    sequenceStep: null,
    lastRelanceAt: sentAt,
    nextFollowUp: null,
    note: client.note?.includes("Séquence terminée")
      ? client.note
      : [client.note, "Séquence terminée (J+1 + J+3)"]
          .filter(Boolean)
          .join(" · "),
  };
}

export function buildSequenceMessage(
  client: LocalClientRecord,
  storeName: string,
  step?: SequenceStep
): string {
  const resolved = step ?? client.sequenceStep ?? 1;
  const templateId = sequenceTemplateId(resolved);
  return buildMessageFromTemplate(templateId, {
    clientName: client.name,
    storeName,
    note: client.note,
    followUpDate: client.nextFollowUp,
  });
}

/**
 * Clients dont la relance séquence est due aujourd’hui (ou en retard).
 * Inclut aussi les nextFollowUp manuels sans séquence (step déduit).
 */
export function getDueSequenceItems(
  clients: LocalClientRecord[],
  today = todayISO()
): SequenceDueItem[] {
  const items: SequenceDueItem[] = [];

  for (const client of clients) {
    if (!client.phone?.trim()) continue;
    if (!client.nextFollowUp) continue;
    if (client.nextFollowUp > today) continue;

    const overdue = client.nextFollowUp < today;
    const step: SequenceStep =
      client.sequenceStep === 2 ? 2 : client.sequenceStep === 1 ? 1 : 1;

    items.push({
      client,
      step,
      label: sequenceStepLabel(step),
      reason: overdue
        ? `En retard depuis le ${client.nextFollowUp}`
        : `Prévu aujourd’hui (${sequenceStepLabel(step)})`,
      overdue,
    });
  }

  items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return (a.client.nextFollowUp || "").localeCompare(b.client.nextFollowUp || "");
  });

  return items;
}

/** Enroler les prospects / à relancer sans date ni séquence. */
export function enrollClientsNeedingSequence(
  clients: LocalClientRecord[],
  fromDate = todayISO()
): { clients: LocalClientRecord[]; enrolled: number } {
  let enrolled = 0;
  const next = clients.map((client) => {
    if (!client.phone?.trim()) return client;
    if (client.sequenceStep) return client;
    if (client.nextFollowUp) return client;
    if (client.status !== "prospect" && client.status !== "relance") return client;
    enrolled += 1;
    return startFollowUpSequence(client, fromDate);
  });
  return { clients: next, enrolled };
}
