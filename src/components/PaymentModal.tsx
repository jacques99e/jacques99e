"use client";

import { useState } from "react";
import { X, CheckCircle } from "lucide-react";
import { Button } from "./ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { formatCurrency } from "@/lib/utils";
import type { PaymentMethod } from "@/types";

interface PaymentModalProps {
  total: number;
  onClose: () => void;
  onConfirm: (method: PaymentMethod) => void | Promise<void>;
}

const methods: { id: PaymentMethod; labelKey: string; color: string }[] = [
  { id: "orange_money", labelKey: "payment.orange", color: "bg-orange-500" },
  { id: "mtn_momo", labelKey: "payment.mtn", color: "bg-yellow-500" },
  { id: "moov_money", labelKey: "payment.moov", color: "bg-blue-600" },
  { id: "mpesa", labelKey: "payment.mpesa", color: "bg-green-600" },
  { id: "cash", labelKey: "sales.cash", color: "bg-gray-600" },
];

export function PaymentModal({ total, onClose, onConfirm }: PaymentModalProps) {
  const { t } = useI18n();
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [failed, setFailed] = useState(false);

  const pay = async (method: PaymentMethod) => {
    if (method === "cash") {
      await onConfirm(method);
      return;
    }

    setProcessing(true);
    setFailed(false);
    try {
      const res = await fetch("/api/payments/momo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total, method }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(async () => {
          await onConfirm(method);
        }, 800);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-4 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">{t("sales.payment")}</h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-2xl font-bold text-center text-wazo-orange">
          {formatCurrency(total)}
        </p>

        {success ? (
          <div className="flex flex-col items-center gap-2 py-8 text-green-600">
            <CheckCircle className="h-12 w-12" />
            <p>{t("payment.success")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {methods.map((m) => (
              <Button
                key={m.id}
                type="button"
                className={`w-full justify-start ${m.color} text-white hover:opacity-90`}
                disabled={processing}
                onClick={() => pay(m.id)}
              >
                {t(m.labelKey)}
              </Button>
            ))}
            {processing && <p className="text-center text-sm text-gray-500">{t("payment.processing")}</p>}
            {failed && <p className="text-center text-sm text-red-600">{t("payment.failed")}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
