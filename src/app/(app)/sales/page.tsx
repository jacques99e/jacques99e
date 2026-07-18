"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2, Megaphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { VoiceSaleButton } from "@/components/VoiceSaleButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { syncStoreToCloud } from "@/lib/cloud-sync";
import { appendLocalSale } from "@/lib/local-sales";
import { activePromotions, applyDiscount, discountForProduct } from "@/lib/commerce-promotions";
import { localStore } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { getProducts, saveProduct } from "@/lib/products";
import { productToLegacy } from "@/lib/product-legacy-mirror";
import type { LocalProduct } from "@/lib/local-products";
import type { ParsedSaleResult } from "@/lib/parse-sale-local";

interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

interface LocalSale {
  id: string;
  store_id?: string;
  items: Array<{
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  total: number;
  date: string;
  payment_method: string;
  payment_status?: string;
}

export default function SalesPage() {
  const router = useRouter();
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [voiceHint, setVoiceHint] = useState("");
  const [confirmation, setConfirmation] = useState<{
    total: number;
    whatsappLink: string;
    paymentMethod: string;
    syncWarning?: string;
  } | null>(null);

  useEffect(() => {
    const store = localStore.get();
    if (!store?.id) return;
    void getProducts(store.id).then((rows) => setProducts(rows.map(productToLegacy)));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const total = subtotal;

  const store = localStore.get();
  const promos = activePromotions(store?.id);

  const addToCart = (product: LocalProduct) => {
    if (product.stock <= 0) return;
    const disc = discountForProduct(product.id, store?.id);
    const unitPrice = disc
      ? applyDiscount(product.price, disc.percent)
      : product.price;
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((c) =>
          c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: disc ? `${product.name} (-${disc.percent}%)` : product.name,
          unitPrice,
          quantity: 1,
        },
      ];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const maxStock = products.find((p) => p.id === productId)?.stock ?? 0;
          const nextQty = Math.max(0, Math.min(item.quantity + delta, maxStock));
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const applyVoiceSale = (result: ParsedSaleResult) => {
    const nextCart: CartItem[] = [];
    for (const item of result.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || product.stock <= 0) continue;
      const disc = discountForProduct(product.id, store?.id);
      const unitPrice = disc
        ? applyDiscount(product.price, disc.percent)
        : product.price;
      const quantity = Math.min(item.quantity, product.stock);
      nextCart.push({
        productId: product.id,
        name: disc ? `${product.name} (-${disc.percent}%)` : product.name,
        unitPrice,
        quantity,
      });
    }
    if (!nextCart.length) {
      setVoiceHint("Aucun produit du stock n’a pu être ajouté.");
      return;
    }
    setCart(nextCart);
    if (result.paymentMethod) setPaymentMethod(result.paymentMethod);
    setVoiceHint(
      `Panier prérempli (${result.source === "ai" ? "IA" : "local"}) : ${nextCart
        .map((i) => `${i.quantity}× ${i.name}`)
        .join(", ")}. Vérifiez puis finalisez.`
    );
  };

  const finalizeSale = async () => {
    if (cart.length === 0) return;

    const updatedProducts = products.map((product) => {
      const cartItem = cart.find((c) => c.productId === product.id);
      if (!cartItem) return product;
      const nextStock = Math.max(0, product.stock - cartItem.quantity);
      return {
        ...product,
        stock: nextStock,
        stock_quantity: nextStock,
      };
    });
    setProducts(updatedProducts);

    const store = localStore.get();
    const storeId = store?.id || "local-store";

    if (store?.id) {
      for (const product of updatedProducts) {
        const cartItem = cart.find((c) => c.productId === product.id);
        if (!cartItem) continue;
        try {
          await saveProduct(store.id, {
            id: product.id,
            name: product.name,
            description: product.description ?? null,
            price: product.price,
            stock_quantity: product.stock,
            barcode: null,
            image_url: null,
            is_active: true,
          });
        } catch {
          // Sale still recorded locally if cloud stock update fails.
        }
      }
    }
    const sale: LocalSale = {
      id: `sale-${crypto.randomUUID()}`,
      store_id: storeId,
      items: cart.map((item) => ({
        product_id: item.productId,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.quantity * item.unitPrice,
      })),
      total,
      date: new Date().toISOString(),
      payment_method: paymentMethod,
      payment_status: "completed",
    };

    appendLocalSale(storeId, { ...sale, store_id: storeId });
    if (!navigator.onLine) {
      localStorage.setItem("wazo_offline_sale", "1");
    }

    let syncWarning: string | undefined;
    if (store?.id && navigator.onLine) {
      const syncResult = await syncStoreToCloud(storeId);
      if (syncResult.errors.length) {
        syncWarning = syncResult.errors.join(" · ");
      } else if (syncResult.localSalesPending > 0) {
        syncWarning =
          "Vente enregistrée sur cet appareil. Synchronisation cloud en attente — ouvrez Paramètres > Synchroniser.";
      }
    }

    const receiptText = [
      "Reçu Wazo Digital",
      ...sale.items.map((i) => `- ${i.name} x${i.quantity} = ${formatCurrency(i.line_total)}`),
      `TOTAL: ${formatCurrency(sale.total)}`,
    ].join("\n");
    const whatsappLink = `https://wa.me/?text=${encodeURIComponent(receiptText)}`;

    setConfirmation({ total: sale.total, whatsappLink, paymentMethod, syncWarning });
    setCart([]);
    setPaymentMethod("cash");
    setTimeout(() => {
      router.push("/dashboard");
    }, 3000);
  };

  const startNewSale = () => {
    setConfirmation(null);
    setCart([]);
  };

  return (
    <>
      <AppHeader title="Caisse" subtitle="Enregistrer une vente" />
      <main className="app-page flex flex-col gap-3 pb-44">
        {promos.length > 0 ? (
          <Link
            href="/sales/promotions"
            className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900"
          >
            <Megaphone className="h-4 w-4 shrink-0" />
            {promos.length} promo(s) active(s) — réductions appliquées au panier
          </Link>
        ) : (
          <Link href="/sales/promotions" className="text-center text-xs text-[#075E54] underline">
            Créer une promotion flash
          </Link>
        )}

        <VoiceSaleButton
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            stock: p.stock,
          }))}
          onParsed={applyVoiceSale}
        />
        {voiceHint ? (
          <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            {voiceHint}
          </p>
        ) : null}

        {confirmation && (
          <section className="app-card space-y-3 border-green-200 bg-green-50/50 p-4">
            <p className="text-sm font-medium text-green-700">
              Vente enregistrée avec succès ! Total: {formatCurrency(confirmation.total)}
            </p>
            <p className="text-xs text-gray-600">
              Méthode de paiement: {confirmation.paymentMethod === "cash" ? "Espèces" : confirmation.paymentMethod}
            </p>
            {confirmation.syncWarning ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {confirmation.syncWarning}
              </p>
            ) : (
              <p className="text-xs text-green-700">Synchronisée avec le cloud.</p>
            )}
            <Button asChild className="w-full" variant="outline">
              <a href={confirmation.whatsappLink} target="_blank" rel="noreferrer">
                Partager le reçu via WhatsApp
              </a>
            </Button>
            <Button variant="orange" className="w-full" onClick={startNewSale}>
              Nouvelle vente
            </Button>
          </section>
        )}

        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit"
          className="h-12"
        />
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["cash", "Espèces"],
              ["momo", "MoMo"],
              ["card", "Carte"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPaymentMethod(value)}
              className={`rounded-xl px-2 py-2.5 text-xs font-bold transition ${
                paymentMethod === value
                  ? "bg-wazo-green text-white shadow-sm"
                  : "border border-gray-200 bg-white text-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {filtered.length === 0 ? (
            <p className="col-span-2 rounded-xl bg-white p-3 text-xs text-gray-500 shadow-sm">
              Aucun produit pour cette recherche.
            </p>
          ) : null}
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={p.stock <= 0}
              onClick={() => addToCart(p)}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            >
              <div className="relative aspect-[4/3] bg-gray-100">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-300">
                    <Plus className="h-8 w-8" />
                  </div>
                )}
                {p.stock > 0 ? (
                  <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-wazo-orange text-white shadow-md">
                    <Plus className="h-4 w-4" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="absolute inset-x-2 bottom-2 rounded-md bg-black/60 px-2 py-1 text-center text-[10px] font-bold text-white">
                    Rupture
                  </span>
                )}
              </div>
              <div className="space-y-0.5 p-2.5">
                <p className="line-clamp-2 text-xs font-bold leading-snug text-gray-900">{p.name}</p>
                <p className="text-sm font-extrabold text-wazo-green">{formatCurrency(p.price)}</p>
              </div>
            </button>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="fixed bottom-20 left-0 right-0 z-40 safe-bottom">
            <div className="mx-auto max-w-lg px-3">
              <div className="overflow-hidden rounded-t-3xl border border-wazo-green/15 bg-[#FAFAF7] shadow-wazo-lg">
                <div className="border-b border-dashed border-gray-300 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-extrabold uppercase tracking-widest text-wazo-green">
                      Ticket
                    </h2>
                    <span className="text-[10px] font-medium text-gray-400">
                      {cart.reduce((n, i) => n + i.quantity, 0)} article(s)
                    </span>
                  </div>
                </div>
                <div className="max-h-40 space-y-2 overflow-y-auto px-4 py-3">
                  {cart.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                      <div className="flex items-center gap-1.5 rounded-full bg-white px-1.5 py-0.5 shadow-sm">
                        <button type="button" onClick={() => updateQty(item.productId, -1)} className="p-0.5">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-4 text-center text-xs font-bold">{item.quantity}</span>
                        <button type="button" onClick={() => updateQty(item.productId, 1)} className="p-0.5">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="w-[4.5rem] text-right text-xs font-bold tabular-nums">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </span>
                      <button type="button" onClick={() => removeItem(item.productId)} aria-label="Retirer">
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 border-t border-dashed border-gray-300 bg-white px-4 py-3">
                  <div className="flex items-end justify-between">
                    <span className="text-sm font-semibold text-gray-600">TOTAL</span>
                    <span className="text-2xl font-extrabold tracking-tight text-wazo-orange tabular-nums">
                      {formatCurrency(total)}
                    </span>
                  </div>
                  <Button variant="orange" size="lg" className="h-12 w-full text-base font-bold" onClick={finalizeSale}>
                    Encaisser · {paymentMethod === "momo" ? "MoMo" : paymentMethod === "card" ? "Carte" : "Espèces"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {cart.length === 0 && filtered.length > 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-white/60 py-5 text-center text-sm text-gray-400">
            Touchez un produit pour commencer la vente
          </p>
        ) : null}
        {products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-wazo-orange/30 bg-white px-5 py-8 text-center">
            <p className="font-bold text-gray-900">Aucun produit en caisse</p>
            <p className="mt-1 text-sm text-gray-500">Ajoutez d’abord un article au catalogue.</p>
            <Button asChild variant="orange" className="mt-4 w-full">
              <Link href="/products/add">Ajouter un produit</Link>
            </Button>
          </div>
        ) : null}
      </main>
    </>
  );
}
