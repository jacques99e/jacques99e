"use client";

import { useState } from "react";
import { Sparkles, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { localStore } from "@/lib/db";
import {
  getProductLanding,
  landingToDescription,
  productLandingSlug,
  saveProductLanding,
  type ProductLandingContent,
} from "@/lib/product-landing";
import { saveProduct } from "@/lib/products";

interface ProductLandingButtonProps {
  product: {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    stock_quantity: number;
    image_url?: string | null;
    barcode?: string | null;
  };
  storeId: string;
  onUpdated?: (description: string) => void;
}

export function ProductLandingButton({
  product,
  storeId,
  onUpdated,
}: ProductLandingButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const existing = getProductLanding(product.id);

  const generate = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const store = localStore.get();
      const storeName = store?.name || "Wazo Digital";
      const res = await apiFetch("/api/assistant/product-landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: product.name,
          description: product.description,
          price: product.price,
          storeName,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        content?: ProductLandingContent;
        source?: string;
      };
      if (!res.ok || !data.success || !data.content) {
        setError(data.error || "Génération impossible");
        return;
      }

      const content = data.content;
      const description = landingToDescription(content);
      saveProductLanding({
        productId: product.id,
        storeId,
        slug: productLandingSlug(product.name, product.id),
        published: true,
        content,
        updatedAt: new Date().toISOString(),
      });

      await saveProduct(storeId, {
        id: product.id,
        name: product.name,
        description,
        price: product.price,
        stock_quantity: product.stock_quantity,
        barcode: product.barcode ?? null,
        image_url: product.image_url ?? null,
        is_active: true,
      });

      // Best-effort cloud landing columns (migration 017)
      try {
        await apiFetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_id: storeId,
            id: product.id,
            name: product.name,
            description,
            price: product.price,
            stock_quantity: product.stock_quantity,
            barcode: product.barcode ?? null,
            image_url: product.image_url ?? null,
            landing_content: content,
            landing_published: true,
            slug: productLandingSlug(product.name, product.id),
          }),
        });
      } catch {
        /* optional */
      }

      onUpdated?.(description);
      setMessage(
        data.source === "ai"
          ? "Page vente générée et description mise à jour."
          : "Page vente créée (modèle local) — description mise à jour."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const share = () => {
    const store = localStore.get();
    if (!store?.slug) {
      setError("Publiez d’abord votre boutique (slug manquant).");
      return;
    }
    const url = `${window.location.origin}/boutique/${store.slug}/produit/${product.id}`;
    const pitch =
      existing?.content.whatsappPitch ||
      `Découvrez ${product.name} : ${url}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${pitch}\n${url}`)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-[#FF6F00]/40 text-[#FF6F00]"
          disabled={loading}
          onClick={() => void generate()}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {loading ? "Génération…" : "Page vente IA"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={share}>
          <Share2 className="h-3.5 w-3.5" />
          Partager
        </Button>
      </div>
      {message ? <p className="text-[11px] text-green-700">{message}</p> : null}
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
