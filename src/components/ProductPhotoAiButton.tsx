"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { normalizeProductImageFile } from "@/lib/product-image";

export type ProductAiFillResult = {
  name: string;
  description: string;
  suggestedPriceFcfa: number | null;
  category: string | null;
  whatsappPitch: string | null;
  source: "ai" | "fallback";
};

interface ProductPhotoAiButtonProps {
  imageFile: File | null;
  onFilled: (result: ProductAiFillResult) => void;
  className?: string;
}

export function ProductPhotoAiButton({
  imageFile,
  onFilled,
  className = "",
}: ProductPhotoAiButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  const analyze = async () => {
    setError("");
    setHint("");
    if (!imageFile) {
      setError("Ajoutez d’abord une photo (Galerie ou Caméra).");
      return;
    }
    if (!navigator.onLine) {
      setError("Connexion requise pour analyser la photo.");
      return;
    }

    setLoading(true);
    try {
      const file = await normalizeProductImageFile(imageFile);
      const form = new FormData();
      form.append("file", file, file.name || "produit.jpg");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);
      let res: Response;
      try {
        res = await apiFetch("/api/assistant/product-from-image", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        warning?: string;
        source?: "ai" | "fallback";
        suggestion?: {
          name: string;
          description: string;
          suggestedPriceFcfa: number | null;
          category: string | null;
          whatsappPitch: string | null;
        };
      };

      if (!res.ok || !data.success || !data.suggestion) {
        setError(
          data.error ||
            "Analyse impossible. Vérifiez votre connexion puis réessayez."
        );
        return;
      }

      onFilled({
        ...data.suggestion,
        source: data.source || "fallback",
      });

      if (data.source === "ai") {
        setHint("Fiche préremplie — vérifiez le nom et le prix.");
      } else {
        setError(
          data.warning ||
            "IA indisponible pour le moment. Complétez la fiche manuellement."
        );
        setHint("");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg.includes("expire") || msg.toLowerCase().includes("abort")
          ? "Analyse trop longue. Réessayez avec une photo plus légère."
          : msg || "Analyse impossible. Remplissez la fiche à la main."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-[#FF6F00]/40 text-[#FF6F00] hover:bg-orange-50"
        disabled={loading || !imageFile}
        onClick={() => void analyze()}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {loading ? "Analyse de la photo…" : "Remplir la fiche avec la photo"}
      </Button>
      {!imageFile ? (
        <p className="mt-1 text-xs text-gray-500">
          Choisissez d’abord une photo via Galerie ou Caméra.
        </p>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      {hint && !error ? (
        <p className="mt-1 text-xs text-green-700">{hint}</p>
      ) : null}
    </div>
  );
}
