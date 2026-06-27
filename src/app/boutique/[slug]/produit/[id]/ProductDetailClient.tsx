"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Package } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { resolveLandingUrl } from "@/lib/public-urls";
import { formatCurrency, getWhatsAppLink } from "@/lib/utils";
import type { Product, Store as StoreType } from "@/types";

interface ProductDetailClientProps {
  store: Pick<StoreType, "id" | "name" | "slug" | "logo_url">;
  product: Product;
  contactPhone?: string;
}

export function ProductDetailClient({
  store,
  product,
  contactPhone = "",
}: ProductDetailClientProps) {
  const { t } = useI18n();
  const landingUrl = resolveLandingUrl();
  const [imageFailed, setImageFailed] = useState(false);
  const inStock = product.stock_quantity > 0;
  const catalogHref = `/boutique/${store.slug}`;

  const orderMessage = `Bonjour ${store.name}! Je souhaite commander: ${product.name} (${formatCurrency(
    product.price
  )})`;

  return (
    <div className="storefront-page min-h-screen pb-10">
      <div className="border-b border-[#075E54]/10 bg-gradient-to-r from-[#075E54] to-[#0a7a6e] px-4 py-2 text-center text-xs font-medium text-white">
        {t("storefront.poweredBy")}{" "}
        <a href={landingUrl} className="font-bold underline underline-offset-2 hover:text-[#FF6F00]">
          Wazo Digital
        </a>
      </div>

      <header className="border-b border-[#075E54]/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 md:px-6">
          <Link
            href={catalogHref}
            className="inline-flex items-center gap-2 rounded-full border border-[#075E54]/15 px-4 py-2 text-sm font-semibold text-[#075E54] transition hover:bg-[#075E54]/5"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("storefront.backToCatalog")}
          </Link>
          <p className="truncate text-sm font-semibold text-[#1A1A1A]/70">{store.name}</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <div className="overflow-hidden rounded-3xl border border-[#075E54]/10 bg-[#FFF8F0] shadow-sm">
            <div className="relative aspect-square">
              {product.image_url && !imageFailed ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-full w-full object-cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#075E54]/10 to-[#FF6F00]/10 text-7xl font-bold text-[#075E54]/40">
                  {product.name[0]?.toUpperCase()}
                </div>
              )}
              <span
                className={`absolute left-4 top-4 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                  inStock ? "bg-[#075E54]/90 text-white" : "bg-[#1A1A1A]/70 text-white"
                }`}
              >
                {inStock ? t("storefront.inStock") : t("storefront.outOfStock")}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-[#075E54]/10 bg-white p-6 shadow-sm md:p-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#FF6F00]">
              {t("storefront.productDetail")}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold text-[#075E54] md:text-4xl">{product.name}</h1>

            <p className="mt-4 text-3xl font-extrabold text-[#FF6F00]">
              {formatCurrency(product.price)}
            </p>

            {inStock ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#075E54]/10 px-3 py-1.5 text-sm font-medium text-[#075E54]">
                <Package className="h-4 w-4" />
                {t("storefront.stockAvailable", { count: product.stock_quantity })}
              </p>
            ) : null}

            {product.description ? (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#1A1A1A]/50">
                  {t("storefront.description")}
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-[#1A1A1A]/75">
                  {product.description}
                </p>
              </div>
            ) : (
              <p className="mt-6 text-sm text-[#1A1A1A]/50">{t("storefront.noDescription")}</p>
            )}

            {contactPhone ? (
              <a
                href={getWhatsAppLink(contactPhone, orderMessage)}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-4 text-base font-bold text-white transition hover:brightness-105"
              >
                <MessageCircle className="h-5 w-5" />
                {t("storefront.order")}
              </a>
            ) : (
              <p className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {t("storefront.whatsappMissing")}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
