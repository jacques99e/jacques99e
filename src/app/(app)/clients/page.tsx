"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ModuleStatGrid } from "@/components/ModuleStatGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { syncStoreToCloud } from "@/lib/cloud-sync";
import { localStore } from "@/lib/db";
import {
  readLocalClients,
  writeLocalClients,
  type LocalClientRecord,
  type ClientStatus,
} from "@/lib/local-clients";
import { getBusinessSettings } from "@/lib/business-settings";
import { buildMessageFromTemplate, openWhatsAppChat } from "@/lib/whatsapp";
import { PLAN_LIMITS, normalizeBillingStatus, type BillingSubscription } from "@/lib/billing";

type ClientRecord = LocalClientRecord;

export default function ClientsPage() {
  const storeId = localStore.get()?.id;
  const [clients, setClients] = useState<ClientRecord[]>(() =>
    readLocalClients(storeId || undefined)
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [status, setStatus] = useState<ClientStatus>("prospect");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ClientStatus>("all");
  const [error, setError] = useState("");
  const [billing, setBilling] = useState<BillingSubscription | null>(null);
  const [whatsappError, setWhatsappError] = useState("");
  const [storeLabel, setStoreLabel] = useState("Wazo Digital");
  const [whatsappTemplateId, setWhatsappTemplateId] = useState(() =>
    getBusinessSettings().defaultWhatsAppTemplateId
  );
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setStoreLabel(localStorage.getItem("store_name") || "Wazo Digital");
  }, []);

  useEffect(() => {
    const loadBilling = async () => {
      try {
        const response = await apiFetch("/api/billing/subscription", { cache: "no-store" });
        const data = (await response.json()) as {
          success: boolean;
          subscription?: BillingSubscription;
        };
        if (response.ok && data.success && data.subscription) {
          setBilling(data.subscription);
        }
      } catch {
        // Keep CRM available in offline mode.
      }
    };
    void loadBilling();
  }, []);

  const reminderBuckets = useMemo(() => {
    const overdue: ClientRecord[] = [];
    const todayDue: ClientRecord[] = [];
    const upcoming: ClientRecord[] = [];
    for (const client of clients) {
      if (!client.nextFollowUp) continue;
      if (client.nextFollowUp < today) overdue.push(client);
      else if (client.nextFollowUp === today) todayDue.push(client);
      else upcoming.push(client);
    }
    upcoming.sort((a, b) => (a.nextFollowUp ?? "").localeCompare(b.nextFollowUp ?? ""));
    return { overdue, todayDue, upcoming };
  }, [clients, today]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((client) => {
      const statusOk = statusFilter === "all" || client.status === statusFilter;
      const searchOk =
        !q ||
        client.name.toLowerCase().includes(q) ||
        client.phone.toLowerCase().includes(q) ||
        client.tags.join(" ").toLowerCase().includes(q);
      return statusOk && searchOk;
    });
  }, [clients, search, statusFilter]);

  const statusLabel = (value: ClientStatus) => {
    if (value === "prospect") return "Prospect";
    if (value === "active") return "Actif";
    return "À relancer";
  };

  const saveAll = (next: ClientRecord[]) => {
    setClients(next);
    if (storeId) {
      writeLocalClients(next, storeId);
      void syncStoreToCloud(storeId);
    } else {
      writeLocalClients(next);
    }
  };

  const addDaysISO = (baseISO: string, days: number) => {
    const d = new Date(baseISO + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const addClient = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return;
    if (billing && normalizeBillingStatus(billing) === "expired") {
      setError("Votre abonnement est expire. Activez un plan pour ajouter des clients.");
      return;
    }
    const maxClients = billing ? PLAN_LIMITS[billing.plan].maxClients : PLAN_LIMITS.starter.maxClients;
    if (clients.length >= maxClients) {
      setError(`Limite atteinte (${maxClients} clients). Passez a un plan superieur.`);
      return;
    }
    const record: ClientRecord = {
      id: `client-${Date.now()}`,
      store_id: storeId,
      name: name.trim(),
      phone: phone.trim(),
      tags: tagsInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      status,
      nextFollowUp: nextFollowUp || null,
      note: note.trim(),
    };
    saveAll([record, ...clients]);
    setName("");
    setPhone("");
    setTagsInput("");
    setStatus("prospect");
    setNextFollowUp("");
    setNote("");
  };

  const setClientStatus = (id: string, nextStatus: ClientStatus) => {
    saveAll(clients.map((client) => (client.id === id ? { ...client, status: nextStatus } : client)));
  };

  const postponeFollowUp = (id: string, days: number) => {
    saveAll(
      clients.map((client) => {
        if (client.id !== id) return client;
        const base = client.nextFollowUp ?? today;
        return {
          ...client,
          status: "relance",
          nextFollowUp: addDaysISO(base, days),
        };
      })
    );
  };

  const markFollowedUp = (id: string) => {
    saveAll(
      clients.map((client) =>
        client.id === id ? { ...client, status: "active", nextFollowUp: null } : client
      )
    );
  };

  const sendWhatsApp = (client: ClientRecord) => {
    setWhatsappError("");
    if (!client.phone?.trim()) {
      setWhatsappError("Ajoutez un numéro de téléphone pour ce client avant d'envoyer WhatsApp.");
      return;
    }
    const message = buildMessageFromTemplate(whatsappTemplateId, {
      clientName: client.name,
      storeName: storeLabel,
      note: client.note,
      followUpDate: client.nextFollowUp,
    });
    const opened = openWhatsAppChat(client.phone, message);
    if (!opened) {
      setWhatsappError("Numéro invalide. Utilisez le format international (ex: +225 07 00 00 00 00).");
      return;
    }
    saveAll(
      clients.map((c) =>
        c.id === client.id ? { ...c, status: "relance" as const } : c
      )
    );
  };

  return (
    <>
      <AppHeader title="Mini CRM Clients" subtitle="Commerce" />
      <main className="app-page space-y-4 pb-6">
        {billing && normalizeBillingStatus(billing) === "expired" ? (
          <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
            Essai expire. Activez un abonnement pour continuer les operations CRM.
          </p>
        ) : null}
        {whatsappError ? (
          <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{whatsappError}</p>
        ) : null}
        <section className="app-card space-y-2 p-3">
          <p className="text-xs font-semibold text-gray-700">Modèle WhatsApp</p>
          <select
            value={whatsappTemplateId}
            onChange={(e) => setWhatsappTemplateId(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
          >
            {getBusinessSettings().whatsappTemplates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
          <Link href="/settings/business" className="text-[10px] text-[#075E54] underline">
            Personnaliser les modèles →
          </Link>
        </section>

        <ModuleStatGrid
          columns={3}
          items={[
            { value: clients.length, label: "Total" },
            { value: clients.filter((client) => client.status === "active").length, label: "Actifs" },
            { value: clients.filter((client) => client.status === "relance").length, label: "Relance" },
          ]}
        />
        <ModuleStatGrid
          items={[
            { value: reminderBuckets.overdue.length, label: "Relances en retard", accent: "text-red-600" },
            { value: reminderBuckets.todayDue.length, label: "Relances aujourd'hui", accent: "text-amber-600" },
          ]}
        />

        {(reminderBuckets.overdue.length > 0 || reminderBuckets.todayDue.length > 0) && (
          <section className="app-card space-y-2 p-3">
            <p className="text-sm font-semibold">Priorités de relance</p>
            {[...reminderBuckets.overdue, ...reminderBuckets.todayDue].map((client) => (
              <div key={`prio-${client.id}`} className="rounded-lg border border-gray-100 p-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{client.name}</p>
                  <span className="text-[11px] text-amber-700">
                    {client.nextFollowUp && client.nextFollowUp < today ? "En retard" : "Aujourd'hui"}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{client.phone || "Téléphone non renseigné"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-[#25D366] text-white hover:bg-[#1ebe57]"
                    onClick={() => sendWhatsApp(client)}
                  >
                    <MessageCircle className="mr-1 h-3.5 w-3.5" />
                    WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => markFollowedUp(client.id)}>
                    Relancé
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => postponeFollowUp(client.id, 1)}>
                    +1 jour
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => postponeFollowUp(client.id, 7)}>
                    +7 jours
                  </Button>
                </div>
              </div>
            ))}
          </section>
        )}

        <form onSubmit={addClient} className="app-card space-y-2 p-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom client" required />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" />
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Tags (ex: VIP, gros-volume)"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ClientStatus)}
              className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="prospect">Prospect</option>
              <option value="active">Actif</option>
              <option value="relance">À relancer</option>
            </select>
            <Input
              type="date"
              value={nextFollowUp}
              onChange={(e) => setNextFollowUp(e.target.value)}
              placeholder="Prochaine relance"
            />
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note rapide" />
          <Button className="w-full" type="submit">
            Ajouter client
          </Button>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </form>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (nom, téléphone, tag)"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | ClientStatus)}
          className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
        >
          <option value="all">Tous statuts</option>
          <option value="prospect">Prospect</option>
          <option value="active">Actif</option>
          <option value="relance">À relancer</option>
        </select>

        <section className="space-y-2">
          {filteredClients.map((client) => (
            <article key={client.id} className="app-card p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{client.name}</p>
                <span className="rounded-full bg-[#075E54]/10 px-2 py-0.5 text-xs text-[#075E54]">
                  {statusLabel(client.status)}
                </span>
              </div>
              <p className="text-xs text-gray-500">{client.phone || "Téléphone non renseigné"}</p>
              {client.tags.length ? (
                <p className="mt-1 text-xs text-gray-600">Tags: {client.tags.join(", ")}</p>
              ) : null}
              {client.nextFollowUp ? (
                <p className="mt-1 text-xs text-amber-700">Relance: {client.nextFollowUp}</p>
              ) : null}
              {client.note ? <p className="mt-1 text-xs text-gray-700">{client.note}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-[#25D366] text-white hover:bg-[#1ebe57]"
                  onClick={() => sendWhatsApp(client)}
                >
                  <MessageCircle className="mr-1 h-3.5 w-3.5" />
                  WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={() => setClientStatus(client.id, "prospect")}>
                  Prospect
                </Button>
                <Button size="sm" variant="outline" onClick={() => setClientStatus(client.id, "active")}>
                  Actif
                </Button>
                <Button size="sm" variant="outline" onClick={() => setClientStatus(client.id, "relance")}>
                  Relance
                </Button>
              </div>
            </article>
          ))}
          {filteredClients.length === 0 ? (
            <p className="rounded-xl bg-white p-3 text-xs text-gray-500 shadow-sm dark:bg-gray-800">
              Aucun client pour ce filtre.
            </p>
          ) : null}
        </section>
      </main>
    </>
  );
}

