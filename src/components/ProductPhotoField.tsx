"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  normalizeProductImageFile,
  revokePreviewUrl,
} from "@/lib/product-image";

interface ProductPhotoFieldProps {
  previewUrl: string;
  onChange: (file: File, previewUrl: string) => void;
  label?: string;
  /** Variante compacte (édition produit). */
  compact?: boolean;
}

/**
 * Sélecteur photo fiable sur mobile :
 * - Galerie (sans capture forcé)
 * - Caméra optionnelle
 * - Input en overlay (évite display:none qui casse certains WebViews)
 */
export function ProductPhotoField({
  previewUrl,
  onChange,
  label = "Photo du produit",
  compact = false,
}: ProductPhotoFieldProps) {
  const galleryId = useId();
  const cameraId = useId();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      // ne pas révoquer les URLs http(s) existantes du produit
    };
  }, []);

  const applyFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const normalized = await normalizeProductImageFile(file);
      const nextPreview = URL.createObjectURL(normalized);
      if (previewUrl.startsWith("blob:")) {
        revokePreviewUrl(previewUrl);
      }
      onChange(normalized, nextPreview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image invalide");
    } finally {
      setBusy(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  const zoneClass = compact
    ? "relative mx-auto flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-wazo-green/30 bg-wazo-cream"
    : "relative mt-1 flex h-40 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500";

  return (
    <div>
      {!compact ? (
        <p className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </p>
      ) : null}

      <div
        className={zoneClass}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!busy) galleryRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!busy) galleryRef.current?.click();
          }
        }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="pointer-events-none h-full w-full object-cover"
          />
        ) : (
          <div className="pointer-events-none flex flex-col items-center gap-1 px-2 text-center">
            <Camera className={compact ? "h-8 w-8 text-wazo-green" : "h-7 w-7"} />
            {!compact ? (
              <span className="text-xs">
                {busy ? "Préparation…" : "Choisir une photo"}
              </span>
            ) : null}
          </div>
        )}

        <input
          id={galleryId}
          ref={galleryRef}
          type="file"
          accept="image/*,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void applyFile(e.target.files?.[0])}
        />
        <input
          id={cameraId}
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void applyFile(e.target.files?.[0])}
        />
      </div>

      {compact ? (
        <p className="mt-1 text-center text-xs text-gray-500">{label}</p>
      ) : null}

      <div className={`mt-2 flex flex-wrap gap-2 ${compact ? "justify-center" : ""}`}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            galleryRef.current?.click();
          }}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Galerie
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            cameraRef.current?.click();
          }}
        >
          <Camera className="h-3.5 w-3.5" />
          Caméra
        </Button>
      </div>

      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
