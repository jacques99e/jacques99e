"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAlerts } from "@/hooks/useAlerts";
import { useStoreNotifications } from "@/hooks/useStoreNotifications";

export default function NotificationsPage() {
  const { summary } = useAlerts();
  const { items, unread, loading, markRead } = useStoreNotifications({ list: true });

  return (
    <>
      <AppHeader title="Notifications" subtitle="Votre évolution" />
      <main className="app-page space-y-4 pb-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-600">
            {unread > 0 ? `${unread} non lue(s)` : "Tout est à jour"}
          </p>
          {unread > 0 ? (
            <Button variant="outline" size="sm" onClick={() => void markRead()}>
              Tout marquer lu
            </Button>
          ) : null}
        </div>

        {summary.total > 0 ? (
          <section className="app-card space-y-2 p-4">
            <h2 className="text-sm font-semibold">À traiter maintenant</h2>
            {summary.stockAlerts > 0 ? (
              <Link href="/products" className="block text-sm text-amber-800">
                {summary.stockAlerts} alerte(s) stock
              </Link>
            ) : null}
            {summary.clientAlerts > 0 ? (
              <Link href="/clients" className="block text-sm text-amber-800">
                {summary.clientAlerts} relance(s) client
              </Link>
            ) : null}
          </section>
        ) : null}

        {loading && items.length === 0 ? (
          <p className="text-sm text-gray-500">Chargement…</p>
        ) : null}

        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href || "/dashboard"}
            onClick={() => {
              if (!item.read_at) void markRead([item.id]);
            }}
            className={`app-card block space-y-1 p-4 ${item.read_at ? "opacity-70" : ""}`}
          >
            <div className="flex items-start gap-2">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-[#075E54]" />
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-gray-600">{item.body}</p>
                <p className="mt-1 text-[10px] text-gray-400">
                  {new Date(item.created_at).toLocaleString("fr-FR")}
                </p>
              </div>
            </div>
          </Link>
        ))}

        {!loading && items.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-gray-500 shadow-sm">
            Pas encore de message. Dès que votre boutique avance (produit, vente, essai),
            ça apparaît ici — et par e-mail le lundi.
          </p>
        ) : null}

        <Link href="/settings/notifications" className="block text-center text-xs text-gray-500">
          Régler l&apos;e-mail d&apos;évolution →
        </Link>
      </main>
    </>
  );
}
