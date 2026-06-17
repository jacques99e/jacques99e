"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProductForm } from "@/components/ProductForm";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/db";
import { deleteProduct, getProducts } from "@/lib/products";
import { localStore } from "@/lib/db";
import type { Product } from "@/types";

export default function EditProductPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(params.id as string);
  const { user } = useAuth();
  const storeId = useMemo(() => localStore.get()?.id ?? null, []);
  const [product, setProduct] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // 1) Prefer Dexie local record (fast, supports offline).
      if (db) {
        const p = await db.products.get(id);
        if (cancelled) return;
        if (p) {
          setProduct(p as Product);
          return;
        }
      }

      // 2) Fallback: re-fetch from server (or repopulate Dexie) if online.
      if (!storeId) return;
      const rows = await getProducts(storeId);
      if (cancelled) return;
      const found = rows.find((p) => p.id === id) ?? null;
      setProduct(found);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, storeId]);

  const handleDelete = async () => {
    if (!confirm(t("products.delete") + "?")) return;
    setDeleteError("");
    try {
      await deleteProduct(id, product?.store_id ?? storeId ?? undefined);
      router.push("/products");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Impossible de supprimer le produit.");
    }
  };

  if (!product) {
    return (
      <>
        <AppHeader title={t("products.title")} />
        <p className="p-4 text-center">{t("common.loading")}</p>
      </>
    );
  }

  return (
    <>
      <AppHeader title={product.name} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <ProductForm product={product} storeId={product.store_id} userId={user?.id ?? ""} />
        <Button variant="destructive" className="w-full" onClick={handleDelete}>
          {t("products.delete")}
        </Button>
        {deleteError ? <p className="text-center text-sm text-red-600">{deleteError}</p> : null}
      </main>
    </>
  );
}
