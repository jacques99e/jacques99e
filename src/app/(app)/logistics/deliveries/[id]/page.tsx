"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/SignaturePad";
import { useI18n } from "@/contexts/I18nContext";
import { db } from "@/lib/db";
import { updateDeliveryStatus } from "@/lib/logistics";
import type { Delivery, DeliveryStatus } from "@/types";

const STATUSES: DeliveryStatus[] = ["pending", "picked_up", "in_transit", "delivered"];

export default function DeliveryDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [showSign, setShowSign] = useState(false);

  useEffect(() => {
    if (db) db.deliveries.get(id).then((d) => setDelivery(d ?? null));
  }, [id]);

  const setStatus = async (status: DeliveryStatus, signature?: string) => {
    await updateDeliveryStatus(id, status, signature);
    if (db) {
      const d = await db.deliveries.get(id);
      if (d) setDelivery(d);
    }
    setShowSign(false);
  };

  if (!delivery) return <p className="p-4">{t("common.loading")}</p>;

  return (
    <>
      <AppHeader title={delivery.tracking_code} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 text-sm space-y-2">
          <p><strong>{t("logistics.sender")}:</strong> {delivery.sender_name}</p>
          <p><strong>{t("logistics.recipient")}:</strong> {delivery.recipient_name}</p>
          <p><strong>{t("logistics.address")}:</strong> {delivery.address}</p>
          <p className="font-medium capitalize">{delivery.status.replace("_", " ")}</p>
        </section>

        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={delivery.status === s ? "default" : "outline"}
              onClick={() => (s === "delivered" ? setShowSign(true) : setStatus(s))}
            >
              {s}
            </Button>
          ))}
        </div>

        {showSign && (
          <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <p className="mb-2 text-sm font-medium">{t("logistics.sign")}</p>
            <SignaturePad onSave={(sig) => setStatus("delivered", sig)} />
          </section>
        )}

        {delivery.signature_data && (
          <img src={delivery.signature_data} alt="Signature" className="rounded border max-h-24" />
        )}
      </main>
    </>
  );
}
