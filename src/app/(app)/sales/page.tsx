"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreditCard, Mic, Minus, Plus, Smartphone, Trash2, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { syncStoreToCloud } from "@/lib/cloud-sync";
import { readLocalProducts, writeLocalProducts, type LocalProduct } from "@/lib/local-products";
import { appendLocalSale } from "@/lib/local-sales";
import { localStore } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

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
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [voiceBanner, setVoiceBanner] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [confirmation, setConfirmation] = useState<{
    total: number;
    whatsappLink: string;
    paymentMethod: string;
  } | null>(null);

  useEffect(() => {
    setProducts(readLocalProducts());
  }, []);

  useEffect(() => {
    if (searchParams.get("voice") !== "1") return;
    const productName = searchParams.get("product")?.trim();
    const qty = Math.max(1, Number(searchParams.get("qty") || 1));
    const amount = Number(searchParams.get("amount") || 0);
    if (!productName) return;

    const catalog = readLocalProducts();
    const match = catalog.find((p) => p.name.toLowerCase().includes(productName.toLowerCase()));
    if (match && match.stock > 0) {
      setCart([
        {
          productId: match.id,
          name: match.name,
          unitPrice: match.price,
          quantity: Math.min(qty, match.stock),
        },
      ]);
      setVoiceBanner(`Vente vocale : ${match.name}`);
    } else {
      const unitPrice = amount > 0 ? Math.round(amount / qty) : amount;
      setCart([
        {
          productId: `voice-${Date.now()}`,
          name: productName,
          unitPrice: unitPrice || 0,
          quantity: qty,
        },
      ]);
      setVoiceBanner(`Vente vocale : ${productName}`);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const total = subtotal;

  const addToCart = (product: LocalProduct) => {
    if (product.stock <= 0) return;
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
          name: product.name,
          unitPrice: product.price,
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

  const finalizeSale = () => {
    if (cart.length === 0) return;

    const updatedProducts = products.map((product) => {
      const cartItem = cart.find((c) => c.productId === product.id);
      if (!cartItem) return product;
      return {
        ...product,
        stock: Math.max(0, product.stock - cartItem.quantity),
        stock_quantity: Math.max(0, product.stock - cartItem.quantity),
      };
    });
    writeLocalProducts(updatedProducts);
    setProducts(updatedProducts);

    const store = localStore.get();
    const storeId = store?.id || "local-store";
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
    void syncStoreToCloud(storeId);

    const receiptText = [
      "Reçu Wazo Digital",
      ...sale.items.map((i) => `- ${i.name} x${i.quantity} = ${formatCurrency(i.line_total)}`),
      `TOTAL: ${formatCurrency(sale.total)}`,
    ].join("\n");
    const whatsappLink = `https://wa.me/?text=${encodeURIComponent(receiptText)}`;

    setConfirmation({ total: sale.total, whatsappLink, paymentMethod });
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link
            href="/sales/voice"
            className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-900"
          >
            <Mic className="h-4 w-4 shrink-0" /> Voix
          </Link>
          <Link
            href="/sales/liens"
            className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-900"
          >
            <Smartphone className="h-4 w-4 shrink-0" /> Liens MoMo
          </Link>
          <Link
            href="/sales/credit"
            className="flex items-center gap-2 rounded-xl border border-[#075E54]/20 bg-[#075E54]/5 px-3 py-2 text-xs font-medium text-[#075E54]"
          >
            <CreditCard className="h-4 w-4 shrink-0" /> Crédit
          </Link>
          <Link
            href="/sales/tontine"
            className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
          >
            <Users className="h-4 w-4 shrink-0" /> Tontine
          </Link>
        </div>
        {voiceBanner ? (
          <p className="rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800">{voiceBanner}</p>
        ) : null}
        {confirmation && (
          <section className="app-card space-y-3 border-green-200 bg-green-50/50 p-4">
            <p className="text-sm font-medium text-green-700">
              Vente enregistrée avec succès ! Total: {formatCurrency(confirmation.total)}
            </p>
            <p className="text-xs text-gray-600">
              Méthode de paiement: {confirmation.paymentMethod === "cash" ? "Espèces" : confirmation.paymentMethod}
            </p>
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
        />
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="app-input-field h-12 text-sm"
        >
          <option value="cash">Espèces</option>
          <option value="momo">Mobile money</option>
          <option value="card">Carte</option>
        </select>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="rounded-xl bg-white p-3 text-xs text-gray-500 shadow-sm">
              Aucun produit pour cette recherche.
            </p>
          ) : null}
          {filtered.map((p) => (
            <div key={p.id} className="app-list-item justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-sm text-[#075E54]">{formatCurrency(p.price)}</p>
                <p className="text-xs text-gray-500">Stock: {p.stock}</p>
              </div>
              {p.stock > 0 ? (
                <Button size="icon" variant="default" className="h-10 w-10 shrink-0" onClick={() => addToCart(p)}>
                  <Plus className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="text-gray-400" disabled>
                  Rupture
                </Button>
              )}
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="fixed bottom-20 left-0 right-0 safe-bottom">
            <div className="mx-auto max-w-lg px-3">
            <div className="space-y-2 rounded-t-3xl border border-gray-100 bg-white/95 p-4 shadow-wazo-lg backdrop-blur-xl">
              <h2 className="text-sm font-bold text-gray-800">Panier</h2>
              {cart.map((item) => (
                <div key={item.productId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => updateQty(item.productId, -1)}>
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-5 text-center">{item.quantity}</span>
                    <button type="button" onClick={() => updateQty(item.productId, 1)}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="w-20 text-right font-medium">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>
                  <button type="button" onClick={() => removeItem(item.productId)} aria-label="Retirer">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <span>Sous-total</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span>TOTAL</span>
                <span className="text-wazo-orange">{formatCurrency(total)}</span>
              </div>
              <Button variant="orange" size="lg" className="w-full" onClick={finalizeSale}>
                Finaliser la vente
              </Button>
            </div>
            </div>
          </div>
        )}

        {cart.length === 0 && (
          <p className="py-8 text-center text-gray-500">Panier vide</p>
        )}
      </main>
    </>
  );
}
