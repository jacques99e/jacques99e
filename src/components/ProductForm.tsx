"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { BarcodeScanner } from "./BarcodeScanner";
import { useI18n } from "@/contexts/I18nContext";
import type { Product } from "@/types";

interface ProductFormProps {
  product?: Product;
}

export function ProductForm({ product }: ProductFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(String(product?.price ?? ""));
  const [quantity, setQuantity] = useState(String(product?.stock_quantity ?? "0"));
  const [description, setDescription] = useState(product?.description ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage("");
    try {
      const productItem: Product = {
        id: product?.id || `local-product-${Date.now()}`,
        store_id: "local-store-test",
        name,
        description: description || null,
        price: Number(price),
        stock_quantity: Number(quantity),
        barcode: barcode || null,
        image_url: imageUrl || null,
        is_active: true,
      };

      const existingRaw = localStorage.getItem("wazo_products");
      const existing = existingRaw ? (JSON.parse(existingRaw) as Product[]) : [];
      const withoutCurrent = existing.filter((p) => p.id !== productItem.id);
      const updatedProducts = [...withoutCurrent, productItem];
      localStorage.setItem("wazo_products", JSON.stringify(updatedProducts));

      setSuccessMessage("Produit enregistré avec succès");
      setTimeout(() => {
        router.push("/products");
      }, 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-wazo-green/30 bg-wazo-cream"
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Camera className="h-8 w-8 text-wazo-green" />
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImage} />
      <p className="text-center text-xs text-gray-500">{t("products.photo")}</p>

      <div>
        <Label>{t("products.name")}</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du produit"
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label>{t("products.description")}</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("products.price")}</Label>
          <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label>{t("products.stock")}</Label>
          <Input
            type="number"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label>{t("products.barcode")}</Label>
        <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="mt-1" />
        <button type="button" className="mt-1 text-sm text-wazo-green" onClick={() => setShowScanner(!showScanner)}>
          {t("products.scan")}
        </button>
      </div>
      {showScanner && (
        <BarcodeScanner
          onScan={(code) => {
            setBarcode(code);
            if (!name) setName(`Produit ${code}`);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("common.loading") : t("products.save")}
      </Button>
      {successMessage && <p className="text-center text-sm text-green-600">{successMessage}</p>}
    </form>
  );
}
