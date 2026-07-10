"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LocalClientRecord } from "@/lib/local-clients";
import {
  advanceFollowUpSequence,
  buildSequenceMessage,
  enrollClientsNeedingSequence,
  getDueSequenceItems,
  sequenceStepLabel,
  startFollowUpSequence,
  todayISO,
  type SequenceDueItem,
} from "@/lib/followup-sequences";
import { openWhatsAppChat } from "@/lib/whatsapp";
import { apiFetch } from "@/lib/api-client";

interface FollowUpSequencePanelProps {
  clients: LocalClientRecord[];
  storeName: string;
  onChange: (next: LocalClientRecord[]) => void;
}

async function maybeAiDraft(
  item: SequenceDueItem,
  storeName: string
): Promise<string | null> {
  try {
    const res = await apiFetch("/api/assistant/draft-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "relance_client",
        storeName,
        clientName: item.client.name,
        context: `${sequenceStepLabel(item.step)} — ${item.reason}`,
      }),
    });
    const data = (await res.json()) as { success?: boolean; message?: string };
    if (res.ok && data.success && data.message?.trim()) return data.message.trim();
  } catch {
    /* fallback template */
  }
  return null;
}

export function FollowUpSequencePanel({
  clients,
  storeName,
  onChange,
}: FollowUpSequencePanelProps) {
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [info, setInfo] = useState("");
  const today = todayISO();

  const due = useMemo(
    () => getDueSequenceItems(clients, today),
    [clients, today]
  );

  const activeSequences = useMemo(
    () => clients.filter((c) => c.sequenceStep === 1 || c.sequenceStep === 2).length,
    [clients]
  );

  const enrollAll = () => {
    const { clients: next, enrolled } = enrollClientsNeedingSequence(clients, today);
    onChange(next);
    setInfo(
      enrolled > 0
        ? `${enrolled} client(s) inscrit(s) en séquence J+1 → J+3.`
        : "Aucun nouveau client à inscrire (déjà planifiés ou sans téléphone)."
    );
  };

  const startOne = (id: string) => {
    onChange(
      clients.map((c) => (c.id === id ? startFollowUpSequence(c, today) : c))
    );
    setInfo("Séquence démarrée : relance J+1 demain.");
  };

  const sendStep = async (item: SequenceDueItem) => {
    setError("");
    setLoadingId(item.client.id);
    try {
      if (!item.client.phone?.trim()) {
        setError("Ajoutez un téléphone pour ce client.");
        return;
      }
      const drafted = await maybeAiDraft(item, storeName);
      const message =
        drafted || buildSequenceMessage(item.client, storeName, item.step);
      const opened = openWhatsAppChat(item.client.phone, message);
      if (!opened) {
        setError("Numéro invalide. Utilisez le format international.");
        return;
      }
      onChange(
        clients.map((c) =>
          c.id === item.client.id ? advanceFollowUpSequence(c, today) : c
        )
      );
      setInfo(
        item.step === 1
          ? `${item.client.name} : J+1 envoyée → J+3 planifiée.`
          : `${item.client.name} : séquence terminée.`
      );
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[#075E54]/20 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#075E54]">
            <Sparkles className="h-4 w-4" />
            Séquences de relance J+1 / J+3
          </h2>
          <p className="mt-0.5 text-xs text-gray-600">
            {activeSequences} séquence(s) active(s) · {due.length} à faire aujourd’hui
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={enrollAll}>
          <Play className="h-3.5 w-3.5" />
          Auto-planifier
        </Button>
      </div>

      {info ? <p className="mb-2 text-xs text-emerald-800">{info}</p> : null}
      {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}

      {due.length === 0 ? (
        <p className="text-xs text-gray-500">
          Aucune relance due. Ajoutez un prospect avec téléphone, ou cliquez
          « Auto-planifier ».
        </p>
      ) : (
        <ul className="space-y-2">
          {due.map((item) => (
            <li
              key={item.client.id}
              className="rounded-xl border border-emerald-100 bg-white/90 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">
                  {item.client.name}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    item.overdue
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {item.label}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">{item.reason}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#25D366] text-white hover:bg-[#1ebe57]"
                  disabled={loadingId === item.client.id}
                  onClick={() => void sendStep(item)}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {loadingId === item.client.id
                    ? "Rédaction…"
                    : `Envoyer ${item.label}`}
                </Button>
                {!item.client.sequenceStep ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startOne(item.client.id)}
                  >
                    Démarrer séquence
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
