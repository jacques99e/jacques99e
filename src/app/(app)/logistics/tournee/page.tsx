"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, MessageCircle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { listDeliveries } from "@/lib/logistics";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp-share";
import { trackingUrl } from "@/lib/logistics-public";
import type { Delivery } from "@/types";

const statusOrder: Record<string, number> = {
  pending: 0,
  picked_up: 1,
  in_transit: 2,
  delivered: 3,
  cancelled: 4,
};

export default function TourneePage() {
  const { t } = useI18n();
  const store = localStore.get();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  useEffect(() => {
    if (store) void listDeliveries(store.id).then(setDeliveries);
  }, [store]);

  const tour = useMemo(() => {
    return deliveries
      .filter((d) => d.status !== "delivered" && d.status !== "cancelled")
      .sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
  }, [deliveries]);

  const shareRoute = () => {
    const lines = tour.map(
      (d, i) =>
        `${i + 1}. ${d.recipient_name} — ${d.address}\n   ${t("tournee.code")}: ${d.tracking_code}\n   ${trackingUrl(d.tracking_code)}`
    );
    const msg = t("tournee.routeMsg", { count: tour.length, lines: lines.join("\n\n") });
    void navigator.clipboard.writeText(msg);
    window.open(buildWhatsAppShareUrl(msg), "_blank", "noopener,noreferrer");
  };

  const shareOne = (d: Delivery) => {
    const msg = t("tournee.oneMsg", { name: d.recipient_name, url: trackingUrl(d.tracking_code) });
    if (d.recipient_phone) {
      window.open(buildWhatsAppShareUrl(msg, d.recipient_phone), "_blank", "noopener,noreferrer");
    } else {
      void navigator.clipboard.writeText(msg);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-sky-700 px-4 py-4 text-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-semibold">{t("tournee.title")}</h1>
          <Link href="/logistics" className="text-sm text-white/90">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sky-800">
            <Truck className="h-5 w-5" />
            <p className="text-sm font-semibold">{t("tournee.count", { count: tour.length })}</p>
          </div>
          <p className="mt-1 text-xs text-gray-500">{t("tournee.suggestedOrder")}</p>
          {tour.length > 0 ? (
            <Button type="button" className="mt-3 w-full" onClick={shareRoute}>
              <MessageCircle className="mr-1 h-4 w-4" /> {t("tournee.shareRouteWhatsapp")}
            </Button>
          ) : null}
        </div>

        {tour.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-center text-sm text-gray-500 shadow-sm">
            {t("tournee.noActive")}{" "}
            <Link href="/logistics/deliveries/new" className="text-sky-600 underline">
              {t("tournee.createDelivery")}
            </Link>
          </p>
        ) : (
          <ol className="space-y-2">
            {tour.map((d, index) => (
              <li key={d.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-800">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{d.recipient_name}</p>
                    <p className="flex items-start gap-1 text-xs text-gray-600">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      {d.address}
                    </p>
                    <p className="mt-1 text-xs text-sky-600">
                      {t("tournee.code")} {d.tracking_code}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => shareOne(d)}>
                    <MessageCircle className="mr-1 h-3 w-3" /> {t("tournee.client")}
                  </Button>
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link href={`/logistics/deliveries/${d.id}`}>{t("tournee.detail")}</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
