"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

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
      setError("Ajoutez d’abord une photo du produit.");
      return;
    }
    if (!navigator.onLine) {
      setError("Connexion requise pour analyser la photo.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", imageFile);
      const res = await apiFetch("/api/assistant/product-from-image", {
        method: "POST",
        body: form,
      });
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
        setError(data.error || "Analyse impossible. Remplissez la fiche à la main.");
        return;
      }

      onFilled({
        ...data.suggestion,
        source: data.source || "fallback",
      });

      if (data.source === "ai") {
        setHint("Fiche préremplie — vérifiez le nom et le prix.");
      } else {
        setHint(
          data.warning
            ? "IA indisponible — complétez la fiche manuellement."
            : "Complétez la fiche manuellement."
        );
      }
    } catch {
      setError("Analyse impossible. Remplissez la fiche à la main.");
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
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      {hint && !error ? <p className="mt-1 text-xs text-green-700">{hint}</p> : null}
    </div>
  );
}
