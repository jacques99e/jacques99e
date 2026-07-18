"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  MessageCircle,
  Package,
  Phone,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { resolveLandingUrl } from "@/lib/public-urls";
import { formatCurrency, getWhatsAppLink } from "@/lib/utils";
import type { Product, Store as StoreType } from "@/types";

interface StorefrontClientProps {
  store: StoreType & { products: Product[] };
  contactPhone?: string;
}

export function StorefrontClient({ store, contactPhone = "" }: StorefrontClientProps) {
  const { t } = useI18n();
  const [stickyVisible, setStickyVisible] = useState(false);
  const landingUrl = resolveLandingUrl();
  const productCount = store.products.length;
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onScroll = () => setStickyVisible(window.scrollY > 280);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const waCatalog =
    contactPhone &&
    getWhatsAppLink(
      contactPhone,
      `Bonjour ${store.name}! Je souhaite avoir des informations sur votre catalogue.`
    );

  return (
    <div className="storefront-page min-h-screen pb-28">
      <div className="bg-[#075E54] px-4 py-2 text-center text-[11px] font-medium text-white/90">
        {t("storefront.poweredBy")}{" "}
        <a href={landingUrl} className="font-bold text-white underline underline-offset-2">
          Wazo Digital
        </a>
      </div>

      {/* Hero full-bleed */}
      <header className="relative min-h-[52vh] overflow-hidden md:min-h-[58vh]">
        {store.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={store.cover_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="storefront-hero-mesh absolute inset-0 bg-[#075E54]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/20" />

        <div className="relative mx-auto flex min-h-[52vh] max-w-3xl flex-col items-center justify-end px-5 pb-10 pt-16 text-center text-white md:min-h-[58vh] md:pb-14">
          {store.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={store.logo_url}
              alt=""
              className="mb-4 h-20 w-20 rounded-2xl border-2 border-white/40 object-cover shadow-wazo-lg md:h-24 md:w-24"
            />
          ) : (
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-white/40 bg-white/15 text-3xl font-extrabold shadow-wazo-lg md:h-24 md:w-24 md:text-4xl">
              {store.name[0]?.toUpperCase() || "W"}
            </div>
          )}

          <h1 className="text-4xl font-extrabold tracking-tight drop-shadow-sm md:text-6xl">
            {store.name}
          </h1>

          {store.description ? (
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85 md:text-base">
              {store.description}
            </p>
          ) : (
            <p className="mt-3 text-sm text-white/70">
              {t("storefront.productsCount", { count: productCount })}
            </p>
          )}

          {waCatalog ? (
            <a
              href={waCatalog}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#FF6F00] px-7 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-black/20 transition hover:brightness-110"
            >
              <MessageCircle className="h-5 w-5" />
              {t("storefront.contactWhatsapp")}
            </a>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-[#075E54] md:text-3xl">
              {t("storefront.catalog")}
            </h2>
            <p className="mt-1 text-sm text-[#1A1A1A]/55">
              {t("storefront.productsCount", { count: productCount })}
            </p>
          </div>
        </div>

        {!contactPhone ? (
          <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t("storefront.whatsappMissing")}
          </p>
        ) : null}

        {productCount === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#075E54]/20 bg-white px-6 py-14 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#075E54]/10 text-[#075E54]">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <p className="text-lg font-bold text-[#1A1A1A]">{t("storefront.emptyCatalog")}</p>
            {waCatalog ? (
              <a
                href={waCatalog}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-bold text-white"
              >
                <MessageCircle className="h-4 w-4" />
                {t("storefront.contactWhatsapp")}
              </a>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
            {store.products.map((product) => {
              const inStock = product.stock_quantity > 0;
              const productHref = `/boutique/${store.slug}/produit/${product.id}`;
              return (
                <article
                  key={product.id}
                  className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#075E54]/8 transition hover:shadow-wazo-lg hover:ring-[#075E54]/20"
                >
                  <Link href={productHref} className="flex flex-1 flex-col">
                    <div className="relative aspect-square overflow-hidden bg-[#F3F1EB]">
                      {product.image_url && !failedImages[product.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [product.id]: true }))
                          }
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#075E54]/12 to-[#FF6F00]/10 text-[#075E54]/45">
                          <Package className="h-10 w-10" />
                          <span className="text-2xl font-extrabold">
                            {product.name[0]?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      {!inStock ? (
                        <span className="absolute inset-x-0 bottom-0 bg-black/65 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-white">
                          {t("storefront.outOfStock")}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-1 flex-col p-3 sm:p-4">
                      <h3 className="line-clamp-2 text-sm font-bold leading-snug text-[#1A1A1A] group-hover:text-[#075E54] sm:text-base">
                        {product.name}
                      </h3>
                      <p className="mt-2 text-lg font-extrabold tracking-tight text-[#FF6F00] sm:text-xl">
                        {formatCurrency(product.price)}
                      </p>
                    </div>
                  </Link>

                  <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                    <a
                      href={
                        contactPhone && inStock
                          ? getWhatsAppLink(
                              contactPhone,
                              `Bonjour ${store.name}! Je souhaite commander: ${product.name} (${formatCurrency(
                                product.price
                              )})`
                            )
                          : productHref
                      }
                      target={contactPhone && inStock ? "_blank" : undefined}
                      rel={contactPhone && inStock ? "noreferrer" : undefined}
                      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-extrabold text-white transition sm:text-sm ${
                        inStock && contactPhone
                          ? "bg-[#25D366] hover:brightness-105"
                          : "bg-[#075E54] hover:brightness-110"
                      }`}
                    >
                      {inStock && contactPhone ? (
                        <>
                          <MessageCircle className="h-3.5 w-3.5" />
                          {t("storefront.order")}
                        </>
                      ) : (
                        t("storefront.viewDetails")
                      )}
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
              <p className="font-bold text-[#075E54]">{store.name}</p>
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

      {contactPhone && productCount > 0 && stickyVisible ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#075E54]/10 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(7,94,84,0.12)] backdrop-blur-md safe-bottom">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-[#075E54]">{store.name}</p>
              <p className="text-xs text-[#1A1A1A]/55">{t("storefront.stickyHint")}</p>
            </div>
            <a
              href={waCatalog || "#"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-xs font-extrabold text-white sm:px-5 sm:text-sm"
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
