"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

type Props = {
  storeId: string;
  kind?: "boutique" | "product";
  productId?: string;
  label?: string;
  className?: string;
  includeInstagram?: boolean;
};

export function SocialPublishButton({
  storeId,
  kind = "boutique",
  productId,
  label = "Facebook",
  className,
  includeInstagram = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const publish = async () => {
    setBusy(true);
    setMsg("");
    try {
      const platforms: Array<"facebook" | "instagram"> = ["facebook"];
      if (includeInstagram) platforms.push("instagram");
      const res = await apiFetch("/api/social/meta/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, kind, productId, platforms }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        results?: Record<string, { ok: boolean; error?: string }>;
      };
      if (!res.ok || !data.success) {
        const detail =
          data.error ||
          data.results?.facebook?.error ||
          data.results?.instagram?.error ||
          "Publication impossible";
        if (String(detail).includes("non connecté")) {
          setMsg("Connectez Facebook dans Paramètres métier.");
        } else {
          setMsg(detail);
        }
        return;
      }
      setMsg("Publié sur Facebook ✓");
    } catch {
      setMsg("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-[#1877F2]/40 text-[#1877F2]"
        disabled={busy || !storeId}
        onClick={() => void publish()}
      >
        <Share2 className="mr-1.5 h-3.5 w-3.5" />
        {busy ? "Publication…" : label}
      </Button>
      {msg ? <p className="mt-1 text-[11px] text-gray-500">{msg}</p> : null}
    </div>
  );
}
