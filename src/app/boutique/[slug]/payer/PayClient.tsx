"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Smartphone } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { resolveLandingUrl } from "@/lib/public-urls";
import { trackMetaMomoCheckout } from "@/lib/meta-pixel";
import { paydunyaCheckoutUrl } from "@/lib/paydunya-checkout";
import { formatCurrency } from "@/lib/utils";
import type { Product, Store as StoreType } from "@/types";

interface PayClientProps {
  store: Pick<StoreType, "id" | "name" | "slug" | "logo_url">;
  products: Product[];
  selectedProduct: Product | null;
}

export function PayClient({ store, products, selectedProduct }: PayClientProps) {
  const { t } = useI18n();
  const landingUrl = resolveLandingUrl();
  const catalogHref = `/boutique/${store.slug}`;
  const [productId, setProductId] = useState(selectedProduct?.id || "");
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const product = useMemo(
    () => products.find((p) => p.id === productId) || selectedProduct,
    [products, productId, selectedProduct]
  );

  const qty = Math.min(
    product ? Math.max(1, product.stock_quantity) : 1,
    Math.max(1, Number(quantity) || 1)
  );
  const total = product ? product.price * qty : 0;

  const startPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/boutique/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: store.slug,
          productId: product.id,
          quantity: qty,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        checkout_url?: string;
        return_url?: string;
        status?: string;
      };
      if (!res.ok || !data.success) {
        setError(data.error || t("storefront.payFailed"));
        return;
      }
      trackMetaMomoCheckout(total);
      const checkout = paydunyaCheckoutUrl(data.checkout_url);
      if (checkout) {
        window.location.href = checkout;
        return;
      }
      if (data.return_url) {
        const back = new URL(data.return_url, window.location.origin);
        if (back.origin === window.location.origin) {
          window.location.href = back.pathname + back.search;
          return;
        }
      }
      setError(t("storefront.payFailed"));
    } catch {
      setError(t("storefront.payFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="storefront-page min-h-screen pb-10">
      <div className="bg-[#075E54] px-4 py-2 text-center text-[11px] font-medium text-white/90">
        {t("storefront.poweredBy")}{" "}
        <a href={landingUrl} className="font-bold text-white underline underline-offset-2">
          Wazo Digital
        </a>
      </div>

      <header className="sticky top-0 z-20 border-b border-[#075E54]/10 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link
            href={catalogHref}
            className="inline-flex items-center gap-2 rounded-full border border-[#075E54]/15 px-3.5 py-2 text-sm font-semibold text-[#075E54] transition hover:bg-[#075E54]/5"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("storefront.backToCatalog")}
          </Link>
          <p className="truncate text-sm font-bold text-[#075E54]">{store.name}</p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#075E54]">
          {t("storefront.payMomo")}
        </h1>
        <p className="mt-2 text-sm text-[#1A1A1A]/65">{t("storefront.payMomoHint")}</p>

        {products.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t("storefront.emptyCatalog")}
          </p>
        ) : (
          <form onSubmit={startPay} className="mt-6 space-y-4">
            {!selectedProduct || products.length > 1 ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-[#075E54]">
                  {t("storefront.chooseProduct")}
                </span>
                <select
                  required
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    setQuantity("1");
                  }}
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
                >
                  <option value="">{t("storefront.chooseProduct")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.price)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {product ? (
              <div className="overflow-hidden rounded-2xl border border-[#075E54]/10 bg-white">
                <div className="flex gap-3 p-3">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.image_url}
                      alt=""
                      className="h-20 w-20 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#075E54]/10 text-2xl font-extrabold text-[#075E54]/40">
                      {product.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#1A1A1A]">{product.name}</p>
                    <p className="mt-1 text-lg font-extrabold text-[#FF6F00]">
                      {formatCurrency(product.price)}
                    </p>
                    <p className="text-xs text-[#1A1A1A]/55">
                      {t("storefront.stockAvailable", { count: product.stock_quantity })}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {selectedProduct ? null : (
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-[#075E54]">
                  {t("storefront.quantity")}
                </span>
                <input
                  type="number"
                  min={1}
                  max={product?.stock_quantity || 1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-12 w-full rounded-xl border border-gray-200 px-3 text-sm"
                />
              </label>
            )}

            {product ? (
              <p className="text-center text-base font-extrabold text-[#075E54]">
                Total : {formatCurrency(total)}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading || !product}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FF6F00] px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-[#FF6F00]/20 transition hover:brightness-105 disabled:opacity-60"
            >
              <Smartphone className="h-4 w-4" />
              {loading ? t("storefront.paying") : t("storefront.payNow")}
            </button>
            {error ? <p className="text-center text-xs text-red-600">{error}</p> : null}
          </form>
        )}
      </main>
    </div>
  );
}
