"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/SignaturePad";
import { useI18n } from "@/contexts/I18nContext";
import { db } from "@/lib/db";
import { trackingUrl } from "@/lib/logistics-public";
import { updateDeliveryStatus } from "@/lib/logistics";
import { getWhatsAppLink } from "@/lib/utils";
import type { Delivery, DeliveryStatus } from "@/types";

const STATUSES: DeliveryStatus[] = ["pending", "picked_up", "in_transit", "delivered"];
const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: "En attente",
  picked_up: "Récupérée",
  in_transit: "En transit",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export default function DeliveryDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [showSign, setShowSign] = useState(false);
  const [smsNotice, setSmsNotice] = useState("");
  const [sendingSms, setSendingSms] = useState(false);

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
    if (
      delivery?.recipient_phone &&
      (status === "in_transit" || status === "delivered")
    ) {
      void fetch("/api/logistics/notify-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_id: id }),
      });
    }
  };

  const copyTrackingCode = async () => {
    if (!delivery) return;
    await navigator.clipboard.writeText(delivery.tracking_code);
  };

  const callRecipient = () => {
    if (!delivery) return;
    if (!delivery.recipient_phone) return;
    window.open(`tel:${delivery.recipient_phone}`, "_self");
  };

  const messageRecipient = () => {
    if (!delivery) return;
    if (!delivery.recipient_phone) return;
    window.open(
      getWhatsAppLink(
        delivery.recipient_phone,
        `Bonjour ${delivery.recipient_name}, suivez votre colis : ${trackingUrl(delivery.tracking_code)}`
      ),
      "_blank"
    );
  };

  const sendTrackingSms = async () => {
    setSendingSms(true);
    setSmsNotice("");
    try {
      const res = await fetch("/api/logistics/notify-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_id: delivery?.id }),
      });
      const json = (await res.json()) as { success: boolean; message?: string; error?: string };
      setSmsNotice(json.success ? json.message || "OK" : json.error || "Échec");
    } finally {
      setSendingSms(false);
    }
  };

  if (!delivery) return <p className="p-4">{t("common.loading")}</p>;

  return (
    <>
      <AppHeader title={delivery.tracking_code} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 text-sm space-y-2">
          <p><strong>{t("logistics.sender")}:</strong> {delivery.sender_name}</p>
          <p><strong>{t("logistics.recipient")}:</strong> {delivery.recipient_name}</p>
          <p><strong>Téléphone:</strong> {delivery.recipient_phone ?? "—"}</p>
          <p><strong>{t("logistics.address")}:</strong> {delivery.address}</p>
          <p className="font-medium">Statut: {STATUS_LABELS[delivery.status]}</p>
          <p className="break-all text-xs text-gray-500">{trackingUrl(delivery.tracking_code)}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant="outline" size="sm" onClick={() => void copyTrackingCode()}>Code</Button>
            <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(trackingUrl(delivery.tracking_code))}>Lien</Button>
            <Button variant="outline" size="sm" onClick={callRecipient} disabled={!delivery.recipient_phone}>Appeler</Button>
            <Button variant="outline" size="sm" onClick={messageRecipient} disabled={!delivery.recipient_phone}>WhatsApp</Button>
          </div>
          <Button variant="outline" size="sm" className="w-full" disabled={sendingSms || !delivery.recipient_phone} onClick={() => void sendTrackingSms()}>
            {sendingSms ? "Envoi…" : "SMS suivi au destinataire"}
          </Button>
          {smsNotice ? <p className="text-xs text-amber-700">{smsNotice}</p> : null}
        </section>

        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={delivery.status === s ? "default" : "outline"}
              onClick={() => (s === "delivered" ? setShowSign(true) : setStatus(s))}
            >
              {STATUS_LABELS[s]}
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
