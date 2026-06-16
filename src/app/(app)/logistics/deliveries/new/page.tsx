"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { createDelivery } from "@/lib/logistics";

export default function NewDeliveryPage() {
  const { t } = useI18n();
  const router = useRouter();
  const store = localStore.get();
  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    try {
      const d = await createDelivery(store.id, {
        sender_name: sender,
        recipient_name: recipient,
        recipient_phone: phone,
        address,
      });
      await logAuditEvent({
        action: "delivery_created",
        entityType: "delivery",
        entityId: d.id,
        payload: {
          tracking_code: d.tracking_code,
          recipient_name: d.recipient_name,
          status: d.status,
        },
      });
      router.push(`/logistics/deliveries/${encodeURIComponent(d.id)}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Impossible de creer la livraison.");
    }
  };

  return (
    <>
      <AppHeader title={t("logistics.newDelivery")} />
      <main className="mx-auto max-w-lg p-4">
        <form onSubmit={submit} className="space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <div>
            <Label>{t("logistics.sender")}</Label>
            <Input value={sender} onChange={(e) => setSender(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <Label>{t("logistics.recipient")}</Label>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <Label>{t("auth.phone")}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{t("logistics.address")}</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} required className="mt-1" />
          </div>
          <Button type="submit" className="w-full">{t("common.save")}</Button>
        </form>
      </main>
    </>
  );
}
