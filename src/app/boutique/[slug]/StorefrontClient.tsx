"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  MessageCircle,
  Package,
  Phone,
  ShoppingBag,
  Sparkles,
  Store,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { resolveLandingUrl } from "@/lib/public-urls";
import { formatCurrency, getWhatsAppLink } from "@/lib/utils";
import type { Product, Store as StoreType } from "@/types";

interface StorefrontClientProps {
  store: StoreType & { products: Product[] };
}

export function StorefrontClient({ store }: StorefrontClientProps) {
  const { t } = useI18n();
  const [stickyVisible, setStickyVisible] = useState(false);
  const landingUrl = resolveLandingUrl();
  const contactPhone = (store.whatsapp || store.phone || "").replace(/\s/g, "");
  const hasWhatsApp = contactPhone.replace(/\D/g, "").length >= 8;
  const productCount = store.products.length;
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onScroll = () => setStickyVisible(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="storefront-page min-h-screen pb-24">
      <div className="border-b border-[#075E54]/10 bg-gradient-to-r from-[#075E54] to-[#0a7a6e] px-4 py-2 text-center text-xs font-medium text-white">
        {t("storefront.poweredBy")}{" "}
        <a href={landingUrl} className="font-bold underline underline-offset-2 hover:text-[#FF6F00]">
          Wazo Digital
        </a>
      </div>

      <header className="relative overflow-hidden border-b border-[#075E54]/10">
        {store.cover_url ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${store.cover_url})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#075E54]/78 via-[#075E54]/60 to-[#054A42]/88" />
          </>
        ) : (
          <div className="storefront-hero-mesh absolute inset-0 bg-gradient-to-br from-[#075E54] via-[#075E54] to-[#128C7E]" />
        )}

        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-[#FF6F00]/20" />

        <div className="relative mx-auto max-w-6xl px-4 py-10 text-center text-white md:px-6 md:py-14">
          <div className="storefront-float mx-auto mb-5 inline-flex">
            {store.logo_url ? (
              <img
                src={store.logo_url}
                alt=""
                className="h-24 w-24 rounded-3xl border-4 border-white/30 object-cover shadow-wazo-lg"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-white/30 bg-white/20 text-4xl font-bold shadow-wazo-lg">
                {store.name[0]?.toUpperCase() || "W"}
              </div>
            )}
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-1.5 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-[#FF6F00]" />
            {t("storefront.badge")}
          </span>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">{store.name}</h1>

          {store.description ? (
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/85 md:text-base">
              {store.description}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-2 text-xs font-semibold">
              <Package className="h-4 w-4 text-[#FF6F00]" />
              {t("storefront.productsCount", { count: productCount })}
            </span>
            {hasWhatsApp ? (
              <a
                href={getWhatsAppLink(
                  contactPhone,
                  `Bonjour ${store.name}! Je souhaite avoir des informations sur votre catalogue.`
                )}
                target="_blank"
                rel="noreferrer"
                className="storefront-cta-pulse inline-flex items-center gap-2 rounded-full bg-[#FF6F00] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#FF6F00]/30 transition hover:brightness-110 md:text-sm"
              >
                <MessageCircle className="h-4 w-4" />
                {t("storefront.contactWhatsapp")}
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="mb-8 text-center md:text-left">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#FF6F00]">
            {t("storefront.catalogEyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#075E54] md:text-3xl">{t("storefront.catalog")}</h2>
          <p className="mt-2 text-sm text-[#1A1A1A]/65">{t("storefront.catalogHint")}</p>
        </div>

        {!hasWhatsApp ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Commande WhatsApp indisponible : le propriétaire doit renseigner un numéro dans{" "}
            <strong>Paramètres métier</strong> de l&apos;application.
          </div>
        ) : null}

        {productCount === 0 ? (
          <div className="rounded-3xl border border-[#075E54]/10 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#075E54]/10 text-[#075E54]">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <p className="font-semibold text-[#1A1A1A]">{t("storefront.emptyCatalog")}</p>
            {hasWhatsApp ? (
              <a
                href={getWhatsAppLink(
                  contactPhone,
                  `Bonjour ${store.name}! Je souhaite avoir des informations sur votre catalogue.`
                )}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white"
              >
                <MessageCircle className="h-4 w-4" />
                {t("storefront.contactWhatsapp")}
              </a>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {store.products.map((product) => {
              const inStock = product.stock_quantity > 0;
              return (
                <article
                  key={product.id}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-[#075E54]/10 bg-white shadow-sm transition hover:border-[#075E54]/25 hover:shadow-wazo-lg"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#FFF8F0]">
                    {product.image_url && !failedImages[product.id] ? (
                      <img
                        src={product.image_url}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [product.id]: true }))
                        }
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#075E54]/10 to-[#FF6F00]/10 text-5xl font-bold text-[#075E54]/40">
                        {product.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <span
                      className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        inStock
                          ? "bg-[#075E54]/90 text-white"
                          : "bg-[#1A1A1A]/70 text-white"
                      }`}
                    >
                      {inStock ? t("storefront.inStock") : t("storefront.outOfStock")}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="text-lg font-bold text-[#1A1A1A]">{product.name}</h3>
                    {product.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[#1A1A1A]/60">{product.description}</p>
                    ) : null}
                    <p className="mt-3 text-xl font-extrabold text-[#FF6F00]">
                      {formatCurrency(product.price)}
                    </p>

                    <a
                      href={
                        hasWhatsApp
                          ? getWhatsAppLink(
                              contactPhone,
                              `Bonjour ${store.name}! Je souhaite commander: ${product.name} (${formatCurrency(
                                product.price
                              )})`
                            )
                          : "#"
                      }
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={!hasWhatsApp}
                      className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-white transition ${
                        hasWhatsApp
                          ? "bg-[#25D366] hover:brightness-105"
                          : "cursor-not-allowed bg-gray-300 text-gray-600 pointer-events-none"
                      }`}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {t("storefront.order")}
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-[#075E54]/10 bg-white px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#075E54]/10 text-[#075E54]">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-[#075E54]">{store.name}</p>
              <p className="text-xs text-[#1A1A1A]/55">{t("storefront.footerTagline")}</p>
            </div>
          </div>
          <a
            href={`${landingUrl}/register?plan=pro`}
            className="inline-flex items-center gap-2 rounded-full border border-[#075E54]/20 px-5 py-2.5 text-sm font-semibold text-[#075E54] transition hover:bg-[#075E54]/5"
          >
            {t("storefront.createStore")}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </footer>

      {hasWhatsApp && productCount > 0 && stickyVisible ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#075E54]/15 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(7,94,84,0.12)] backdrop-blur-md safe-bottom">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#075E54]">{store.name}</p>
              <p className="text-xs text-[#1A1A1A]/60">{t("storefront.stickyHint")}</p>
            </div>
            <a
              href={getWhatsAppLink(
                contactPhone,
                `Bonjour ${store.name}! Je souhaite avoir des informations sur votre catalogue.`
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white sm:px-5 sm:text-sm"
            >
              <Phone className="h-4 w-4 sm:hidden" />
              <MessageCircle className="hidden h-4 w-4 sm:block" />
              WhatsApp
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
