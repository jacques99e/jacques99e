"use client";

import { MessageCircle } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { formatCurrency, getWhatsAppLink } from "@/lib/utils";
import type { Product, Store } from "@/types";

interface StorefrontClientProps {
  store: Store & { products: Product[] };
}

export function StorefrontClient({ store }: StorefrontClientProps) {
  const { t } = useI18n();

  const orderProduct = (product: Product) => {
    const phone = store.whatsapp || store.phone || "";
    const message = `Bonjour ${store.name}! Je souhaite commander: ${product.name} (${formatCurrency(product.price)})`;
    window.open(getWhatsAppLink(phone, message), "_blank");
  };

  return (
    <div className="min-h-screen bg-wazo-cream">
      <header className="bg-wazo-green px-4 py-8 text-white text-center">
        {store.logo_url && (
          <img src={store.logo_url} alt="" className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
        )}
        <h1 className="text-2xl font-bold">{store.name}</h1>
        {store.description && (
          <p className="mt-1 text-sm text-white/80">{store.description}</p>
        )}
      </header>

      <main className="mx-auto max-w-lg p-4">
        <h2 className="mb-4 text-lg font-semibold text-wazo-green">{t("storefront.catalog")}</h2>
        <div className="grid gap-3">
          {store.products.map((p) => (
            <article key={p.id} className="flex gap-3 rounded-xl bg-white p-3 shadow-sm">
              {p.image_url ? (
                <img src={p.image_url} alt="" className="h-20 w-20 rounded-lg object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-wazo-cream text-2xl font-bold text-wazo-green">
                  {p.name[0]}
                </div>
              )}
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <h3 className="font-medium">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>
                  )}
                  <p className="mt-1 font-bold text-wazo-orange">{formatCurrency(p.price)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => orderProduct(p)}
                  className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-medium text-white"
                >
                  <MessageCircle className="h-4 w-4" />
                  {t("storefront.order")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
