"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { readLocalProducts, writeLocalProducts, type LocalProduct } from "@/lib/local-products";
import { formatCurrency } from "@/lib/utils";

interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

interface LocalSale {
  id: string;
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
}

export default function SalesPage() {
  const router = useRouter();
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [confirmation, setConfirmation] = useState<{
    total: number;
    whatsappLink: string;
  } | null>(null);

  useEffect(() => {
    setProducts(readLocalProducts());
  }, []);

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

    const sale: LocalSale = {
      id: `sale-${Date.now()}`,
      items: cart.map((item) => ({
        product_id: item.productId,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.quantity * item.unitPrice,
      })),
      total,
      date: new Date().toISOString(),
      payment_method: "cash",
    };

    const salesRaw = localStorage.getItem("wazo_sales");
    const sales = salesRaw ? (JSON.parse(salesRaw) as LocalSale[]) : [];
    localStorage.setItem("wazo_sales", JSON.stringify([...sales, sale]));

    const receiptText = [
      "Reçu Wazo Digital",
      ...sale.items.map((i) => `- ${i.name} x${i.quantity} = ${formatCurrency(i.line_total)}`),
      `TOTAL: ${formatCurrency(sale.total)}`,
    ].join("\n");
    const whatsappLink = `https://wa.me/?text=${encodeURIComponent(receiptText)}`;

    setConfirmation({ total: sale.total, whatsappLink });
    setCart([]);
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
      <AppHeader title="Caisse / Vente" />
      <main className="mx-auto max-w-lg flex flex-col gap-3 p-4 pb-44">
        {confirmation && (
          <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-green-700">
              Vente enregistrée avec succès ! Total: {formatCurrency(confirmation.total)}
            </p>
            <Button asChild className="w-full" variant="outline">
              <a href={confirmation.whatsappLink} target="_blank" rel="noreferrer">
                Partager le reçu via WhatsApp
              </a>
            </Button>
            <Button className="w-full bg-[#FF6F00] hover:opacity-90" onClick={startNewSale}>
              Nouvelle vente
            </Button>
          </section>
        )}

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit"
          className="h-11 rounded-lg border px-3"
        />

        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-sm text-[#075E54]">{formatCurrency(p.price)}</p>
                <p className="text-xs text-gray-500">Stock: {p.stock}</p>
              </div>
              {p.stock > 0 ? (
                <Button size="icon" className="h-9 w-9 bg-[#075E54]" onClick={() => addToCart(p)}>
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
          <div className="fixed bottom-16 left-0 right-0 border-t bg-white p-4 shadow-lg safe-bottom">
            <div className="mx-auto max-w-lg space-y-2">
              <h2 className="text-sm font-semibold text-gray-700">Panier</h2>
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
              <Button className="w-full bg-[#075E54] hover:opacity-90" onClick={finalizeSale}>
                Finaliser la vente
              </Button>
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
