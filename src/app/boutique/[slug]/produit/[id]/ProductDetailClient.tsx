"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Package } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { resolveLandingUrl } from "@/lib/public-urls";
import { formatCurrency, getWhatsAppLink } from "@/lib/utils";
import type { ProductLandingContent } from "@/lib/product-landing";
import type { Product, Store as StoreType } from "@/types";

interface ProductDetailClientProps {
  store: Pick<StoreType, "id" | "name" | "slug" | "logo_url">;
  product: Product;
  contactPhone?: string;
  landing?: ProductLandingContent | null;
}

export function ProductDetailClient({
  store,
  product,
  contactPhone = "",
  landing = null,
}: ProductDetailClientProps) {
  const { t } = useI18n();
  const landingUrl = resolveLandingUrl();
  const [imageFailed, setImageFailed] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [codLoading, setCodLoading] = useState(false);
  const [codError, setCodError] = useState("");
  const [codOk, setCodOk] = useState("");
  const inStock = product.stock_quantity > 0;
  const catalogHref = `/boutique/${store.slug}`;

  const headline = landing?.headline || product.name;
  const subheadline = landing?.subheadline || product.description || "";
  const bullets = landing?.bullets || [];
  const cta = landing?.cta || t("storefront.order");

  const orderMessage = useMemo(() => {
    if (landing?.whatsappPitch) {
      return `${landing.whatsappPitch}\n\nProduit: ${product.name} — ${formatCurrency(product.price)}`;
    }
    return `Bonjour ${store.name}! Je souhaite commander: ${product.name} (${formatCurrency(
      product.price
    )})`;
  }, [landing, product.name, product.price, store.name]);

  const submitCod = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodError("");
    setCodOk("");
    setCodLoading(true);
    try {
      const qty = Math.max(1, Number(quantity) || 1);
      const res = await fetch("/api/boutique/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          customerName,
          customerPhone,
          address,
          quantity: qty,
          storeName: store.name,
          sellerPhone: contactPhone,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        whatsappMessage?: string;
        persisted?: boolean;
      };
      if (!res.ok || !data.success) {
        setCodError(data.error || "Commande impossible");
        return;
      }
      setCodOk(
        data.persisted
          ? "Commande enregistrée. Le vendeur a été notifié."
          : "Commande prête — ouvrez WhatsApp pour l’envoyer au vendeur."
      );
      if (contactPhone && data.whatsappMessage) {
        window.open(
          getWhatsAppLink(contactPhone, data.whatsappMessage),
          "_blank",
          "noopener,noreferrer"
        );
      } else if (data.whatsappMessage) {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(data.whatsappMessage)}`,
          "_blank",
          "noopener,noreferrer"
        );
      }
    } catch {
      setCodError("Impossible d’envoyer la commande.");
    } finally {
      setCodLoading(false);
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
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
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

      <main className="mx-auto max-w-6xl md:px-6 md:py-8">
        <div className="grid gap-0 lg:grid-cols-2 lg:items-start lg:gap-8 lg:px-0">
          <div className="relative overflow-hidden bg-[#F3F1EB] lg:rounded-3xl lg:shadow-sm">
            <div className="relative aspect-square w-full">
              {product.image_url && !imageFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-full w-full object-cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#075E54]/12 to-[#FF6F00]/10 text-7xl font-extrabold text-[#075E54]/40">
                  {product.name[0]?.toUpperCase()}
                </div>
              )}
              <span
                className={`absolute left-4 top-4 rounded-md px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white ${
                  inStock ? "bg-[#075E54]/90" : "bg-black/70"
                }`}
              >
                {inStock ? t("storefront.inStock") : t("storefront.outOfStock")}
              </span>
            </div>
          </div>

          <div className="bg-white px-4 py-6 md:rounded-3xl md:border md:border-[#075E54]/10 md:p-8 md:shadow-sm">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#075E54] md:text-4xl">
              {headline}
            </h1>

            <p className="mt-3 text-3xl font-extrabold tracking-tight text-[#FF6F00] md:text-4xl">
              {formatCurrency(product.price)}
            </p>

            {inStock ? (
              <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#075E54]/80">
                <Package className="h-4 w-4" />
                {t("storefront.stockAvailable", { count: product.stock_quantity })}
              </p>
            ) : null}

            {subheadline ? (
              <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-[#1A1A1A]/75">
                {subheadline}
              </p>
            ) : (
              <p className="mt-6 text-sm text-[#1A1A1A]/50">{t("storefront.noDescription")}</p>
            )}

            {bullets.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {bullets.map((b) => (
                  <li key={b} className="flex gap-2 text-sm text-[#1A1A1A]/80">
                    <span className="text-[#075E54]">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {landing?.deliveryNote ? (
              <p className="mt-4 rounded-xl bg-[#FFF8F0] px-3 py-2 text-xs text-[#1A1A1A]/70">
                {landing.deliveryNote}
              </p>
            ) : null}

            {contactPhone ? (
              <a
                href={getWhatsAppLink(contactPhone, orderMessage)}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-4 text-base font-extrabold text-white shadow-lg shadow-[#25D366]/25 transition hover:brightness-105"
              >
                <MessageCircle className="h-5 w-5" />
                {cta}
              </a>
            ) : (
              <p className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {t("storefront.whatsappMissing")}
              </p>
            )}

            {inStock ? (
              <form onSubmit={submitCod} className="mt-6 space-y-3 border-t border-[#075E54]/10 pt-6">
                <p className="text-sm font-bold text-[#075E54]">
                  Ou payer à la livraison
                </p>
                <input
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Votre nom"
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
                />
                <input
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Téléphone WhatsApp"
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
                />
                <input
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Adresse de livraison"
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  max={product.stock_quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Quantité"
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={codLoading}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#FF6F00] px-5 py-3 text-sm font-bold text-white hover:brightness-105 disabled:opacity-60"
                >
                  {codLoading ? "Envoi…" : "Valider la commande COD"}
                </button>
                {codOk ? <p className="text-xs text-green-700">{codOk}</p> : null}
                {codError ? <p className="text-xs text-red-600">{codError}</p> : null}
              </form>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
