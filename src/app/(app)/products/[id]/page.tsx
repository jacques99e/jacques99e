"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProductForm } from "@/components/ProductForm";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { db } from "@/lib/db";
import { deleteProduct } from "@/lib/products";
import type { Product } from "@/types";

export default function EditProductPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(params.id as string);
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!db) return;
    db.products.get(id).then((p) => setProduct(p ?? null));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm(t("products.delete") + "?")) return;
    await deleteProduct(id);
    router.push("/products");
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
        <ProductForm product={product} />
        <Button variant="destructive" className="w-full" onClick={handleDelete}>
          {t("products.delete")}
        </Button>
      </main>
    </>
  );
}
