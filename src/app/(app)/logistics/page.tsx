"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, MessageCircle, Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv, downloadSimplePdf } from "@/lib/export";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { ModulePublicPortals } from "@/components/ModulePublicPortals";
import { ModuleStatGrid } from "@/components/ModuleStatGrid";
import { listDeliveries } from "@/lib/logistics";
import { shareDeliveryTracking } from "@/lib/module-share";
import { trackingUrl } from "@/lib/logistics-public";
import type { Delivery, DeliveryStatus } from "@/types";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  picked_up: "bg-blue-100 text-blue-800",
  in_transit: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
};

const statusLabel: Record<string, string> = {
  pending: "En attente",
  picked_up: "Récupérée",
  in_transit: "En transit",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export default function LogisticsPage() {
  const { t } = useI18n();
  const store = localStore.get();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | DeliveryStatus>("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (store) listDeliveries(store.id).then(setDeliveries);
  }, [store]);

  const filteredDeliveries = deliveries.filter((delivery) => {
    const matchStatus = statusFilter === "all" || delivery.status === statusFilter;
    const keyword = search.trim().toLowerCase();
    const matchSearch =
      keyword.length === 0 ||
      delivery.tracking_code.toLowerCase().includes(keyword) ||
      delivery.recipient_name.toLowerCase().includes(keyword) ||
      delivery.address.toLowerCase().includes(keyword);
    return matchStatus && matchSearch;
  });

  return (
    <>
      <AppHeader title={t("modules.logistics.title")} subtitle="Module" />
      <main className="app-page space-y-4 pb-6">
        <ModuleStatGrid
          columns={3}
          items={[
            { value: deliveries.length, label: "Total", accent: "text-indigo-600" },
            {
              value: deliveries.filter((d) => d.status !== "delivered" && d.status !== "cancelled").length,
              label: "En cours",
              accent: "text-indigo-600",
            },
            {
              value: deliveries.filter((d) => d.status === "delivered").length,
              label: "Livrées",
              accent: "text-indigo-600",
            },
          ]}
        />
        <ModulePublicPortals moduleId="logistics" />

        <Button asChild className="w-full">
          <Link href="/logistics/deliveries/new">
            <Plus className="h-4 w-4" />
            {t("logistics.newDelivery")}
          </Link>
        </Button>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (code, destinataire, adresse)"
        />
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "picked_up", "in_transit", "delivered", "cancelled"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                statusFilter === status
                  ? "bg-[#075E54] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {status === "all" ? "Tous" : statusLabel[status]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                `livraisons-${new Date().toISOString().slice(0, 10)}.csv`,
                filteredDeliveries.map((d) => ({
                  id: d.id,
                  tracking_code: d.tracking_code,
                  recipient_name: d.recipient_name,
                  recipient_phone: d.recipient_phone ?? "",
                  address: d.address,
                  status: d.status,
                  created_at: d.created_at ?? "",
                }))
              )
            }
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={async () =>
              downloadSimplePdf(
                "Liste des livraisons",
                filteredDeliveries.map(
                  (d) => `${d.tracking_code} | ${d.recipient_name} | ${d.status} | ${d.address}`
                ),
                `livraisons-${new Date().toISOString().slice(0, 10)}.pdf`
              )
            }
          >
            Export PDF
          </Button>
        </div>
        <ul className="space-y-2">
          {filteredDeliveries.map((d) => (
            <li key={d.id} className="app-card overflow-hidden p-0">
              <Link
                href={`/logistics/deliveries/${encodeURIComponent(d.id)}`}
                className="block p-3"
              >
                <div className="flex justify-between">
                  <span className="font-mono text-sm">{d.tracking_code}</span>
                  <span className={`rounded px-2 text-xs ${statusColors[d.status]}`}>{statusLabel[d.status]}</span>
                </div>
                <p className="text-sm">{d.recipient_name}</p>
                <p className="text-xs text-gray-500 truncate">{d.address}</p>
              </Link>
              <div className="flex gap-2 border-t border-gray-100 px-3 py-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#25D366]/10 px-2 py-1 text-[10px] font-medium text-[#128C7E]"
                  onClick={() =>
                    shareDeliveryTracking({
                      phone: d.recipient_phone,
                      recipientName: d.recipient_name,
                      trackingCode: d.tracking_code,
                    })
                  }
                >
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-700"
                  onClick={() => {
                    void navigator.clipboard.writeText(trackingUrl(d.tracking_code));
                    setCopiedId(d.id);
                    window.setTimeout(() => setCopiedId(null), 1400);
                  }}
                >
                  <Copy className="h-3 w-3" />
                  {copiedId === d.id ? "Copié" : "Lien suivi"}
                </button>
              </div>
            </li>
          ))}
        </ul>
        {filteredDeliveries.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-gray-500 shadow-sm dark:bg-gray-800">
            Aucune livraison pour ce filtre.
          </p>
        ) : null}
      </main>
    </>
  );
}
