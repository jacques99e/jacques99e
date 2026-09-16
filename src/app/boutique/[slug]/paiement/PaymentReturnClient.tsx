"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { resolveLandingUrl } from "@/lib/public-urls";
import { trackMetaBoutiqueSale } from "@/lib/meta-pixel";
import { formatCurrency } from "@/lib/utils";

interface PaymentReturnClientProps {
  slug: string;
  storeName: string;
  tx: string;
  cancelled: boolean;
}

type PayState = "pending" | "succeeded" | "failed" | "cancelled";

export function PaymentReturnClient({
  slug,
  storeName,
  tx,
  cancelled,
}: PaymentReturnClientProps) {
  const { t } = useI18n();
  const landingUrl = resolveLandingUrl();
  const catalogHref = `/boutique/${slug}`;
  const [state, setState] = useState<PayState>(
    cancelled ? "cancelled" : tx ? "pending" : "failed"
  );
  const [amount, setAmount] = useState<number | null>(null);
  const [productName, setProductName] = useState("");

  useEffect(() => {
    if (!tx) return;
    let stopped = false;

    const poll = async () => {
      const cancelledQuery = cancelled ? "&status=cancelled" : "";
      const maxTries = cancelled ? 1 : 18;
      for (let i = 0; i < maxTries; i++) {
        if (stopped) return;
        try {
          const res = await fetch(
            `/api/boutique/pay/status?tx=${encodeURIComponent(tx)}&slug=${encodeURIComponent(slug)}${cancelledQuery}`
          );
          const data = (await res.json()) as {
            success?: boolean;
            status?: PayState;
            amount?: number;
            product_name?: string;
          };
          if (res.ok && data.success && data.status) {
            if (typeof data.amount === "number") setAmount(data.amount);
            if (data.product_name) setProductName(data.product_name);
            if (data.status !== "pending") {
              setState(data.status);
              if (data.status === "succeeded") {
                trackMetaBoutiqueSale(Number(data.amount) || 0);
              }
              return;
            }
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!stopped && !cancelled) setState("pending");
    };

    void poll();
    return () => {
      stopped = true;
    };
  }, [tx, slug, cancelled]);

  const title =
    state === "succeeded"
      ? t("storefront.paySuccess")
      : state === "cancelled"
        ? t("storefront.payCancelled")
        : state === "failed"
          ? t("storefront.payFailed")
          : t("storefront.payPending");

  const Icon =
    state === "succeeded" ? CheckCircle2 : state === "pending" ? Clock3 : XCircle;
  const iconColor =
    state === "succeeded"
      ? "text-[#075E54]"
      : state === "pending"
        ? "text-amber-600"
        : "text-red-600";

  return (
    <div className="storefront-page min-h-screen">
      <div className="bg-[#075E54] px-4 py-2 text-center text-[11px] font-medium text-white/90">
        {t("storefront.poweredBy")}{" "}
        <a href={landingUrl} className="font-bold text-white underline underline-offset-2">
          Wazo Digital
        </a>
      </div>

      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <Icon className={`h-16 w-16 ${iconColor}`} />
        <h1 className="mt-5 text-2xl font-extrabold text-[#075E54]">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-[#1A1A1A]/70">{storeName}</p>
        {productName ? (
          <p className="mt-3 text-sm text-[#1A1A1A]/80">{productName}</p>
        ) : null}
        {amount ? (
          <p className="mt-1 text-xl font-extrabold text-[#FF6F00]">{formatCurrency(amount)}</p>
        ) : null}

        <Link
          href={catalogHref}
          className="mt-8 inline-flex items-center justify-center rounded-full bg-[#075E54] px-6 py-3 text-sm font-bold text-white"
        >
          {t("storefront.backToStore")}
        </Link>
        {state !== "succeeded" ? (
          <Link
            href={`/boutique/${slug}/payer`}
            className="mt-3 text-sm font-semibold text-[#FF6F00] underline"
          >
            {t("storefront.payMomo")}
          </Link>
        ) : null}
      </main>
    </div>
  );
}
