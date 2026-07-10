"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Package, RefreshCw } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { localStore } from "@/lib/db";
import { formatCurrency, getWhatsAppLink } from "@/lib/utils";

type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled" | "all";

type CodOrder = {
  id: string;
  product_name: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-100 text-sky-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
};

export default function ProductOrdersPage() {
  const storeId = localStore.get()?.id;
  const [orders, setOrders] = useState<CodOrder[]>([]);
  const [filter, setFilter] = useState<OrderStatus>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeId) {
      setError("Boutique introuvable. Reconnectez-vous.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ storeId, status: filter });
      const res = await apiFetch(`/api/boutique/orders?${qs}`, { cache: "no-store" });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        orders?: CodOrder[];
      };
      if (!res.ok || !data.success) {
        setError(data.error || "Impossible de charger les commandes.");
        setOrders([]);
        return;
      }
      setOrders(data.orders || []);
    } catch {
      setError("Erreur réseau.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () => orders.filter((o) => o.status === "pending").length,
    [orders]
  );

  const setStatus = async (order: CodOrder, status: string) => {
    if (!storeId) return;
    setUpdatingId(order.id);
    try {
      const res = await apiFetch("/api/boutique/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, storeId, status }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error || "Mise à jour impossible");
        return;
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status } : o))
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const contactClient = (order: CodOrder) => {
    const msg = [
      `Bonjour ${order.customer_name},`,
      `Concernant votre commande ${order.product_name} (x${order.quantity}).`,
      `Total: ${formatCurrency(order.total_amount)}.`,
      `Statut: ${STATUS_LABEL[order.status] || order.status}.`,
    ].join("\n");
    window.open(getWhatsAppLink(order.customer_phone, msg), "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <AppHeader title="Commandes COD" subtitle="Paiement à la livraison" />
      <main className="app-page space-y-3 pb-6">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/products"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#075E54]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Produits
          </Link>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="app-card p-3">
            <p className="text-xl font-bold text-[#075E54]">{orders.length}</p>
            <p className="text-gray-500">Affichées</p>
          </div>
          <div className="app-card p-3">
            <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-gray-500">En attente</p>
          </div>
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as OrderStatus)}
          className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="confirmed">Confirmées</option>
          <option value="delivered">Livrées</option>
          <option value="cancelled">Annulées</option>
        </select>

        {error ? (
          <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>
        ) : null}

        {loading ? (
          <p className="text-center text-sm text-gray-500">Chargement…</p>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <Package className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">Aucune commande pour ce filtre.</p>
            <p className="mt-1 text-xs text-gray-400">
              Partagez une page produit avec formulaire COD pour recevoir des commandes.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.id} className="app-card space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">
                      {order.product_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(order.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      STATUS_CLASS[order.status] || STATUS_CLASS.pending
                    }`}
                  >
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                </div>

                <p className="text-sm text-gray-800">
                  {order.customer_name} · {order.customer_phone}
                </p>
                <p className="text-xs text-gray-600">{order.address}</p>
                <p className="text-sm font-semibold text-[#FF6F00]">
                  x{order.quantity} — {formatCurrency(order.total_amount)}
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#25D366] hover:bg-[#1ebe57]"
                    onClick={() => contactClient(order)}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </Button>
                  {order.status === "pending" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={updatingId === order.id}
                      onClick={() => void setStatus(order, "confirmed")}
                    >
                      Confirmer
                    </Button>
                  ) : null}
                  {order.status === "confirmed" || order.status === "pending" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={updatingId === order.id}
                      onClick={() => void setStatus(order, "delivered")}
                    >
                      Livrée
                    </Button>
                  ) : null}
                  {order.status !== "cancelled" && order.status !== "delivered" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={updatingId === order.id}
                      onClick={() => void setStatus(order, "cancelled")}
                    >
                      Annuler
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
